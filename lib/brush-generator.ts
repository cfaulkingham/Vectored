
import type { Point, LayerSettings, VectorObject, PolygonVertex, ShapeObject, TextObject, LineObject } from '../types';
import { calculatePolygonBounds, getObjectVisualBounds } from './geometry';
import { measureText } from './text-utils';

/**
 * Creates a seeded pseudo-random number generator using the Mulberry32 algorithm.
 * @param a - The seed value.
 * @returns A function that returns a pseudo-random number between 0 (inclusive) and 1 (exclusive).
 */
function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * Calculates a point along a polyline at a specific cumulative distance from the start.
 * @param points - The points forming the polyline.
 * @param distance - The target cumulative distance along the line.
 * @returns An object containing the {point, angle} at that distance, or null if distance exceeds the total line length.
 */
function getPointAtDistance(points: Point[], distance: number): { point: Point, angle: number } | null {
    let traveled = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const segmentLength = Math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2);
        if (traveled + segmentLength >= distance) {
            const fraction = (distance - traveled) / segmentLength;
            const point: Point = [
                p1[0] + (p2[0] - p1[0]) * fraction,
                p1[1] + (p2[1] - p1[1]) * fraction,
            ];
            const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
            return { point, angle };
        }
        traveled += segmentLength;
    }
    return null;
}

/**
 * Generates a set of vector objects (shapes, text, or lines) placed along a user-drawn stroke.
 * Used by the Pattern Brush tool to create complex, scattered effects like stipple, words, or hatching along a path.
 * 
 * @param strokePoints - The array of points defining the brush stroke path.
 * @param layerSettings - Configuration settings for the layer, including brush type (circles, words, etc.), size, density, and jitter parameters.
 * @param layerColor - The color to apply to the generated objects.
 * @returns An array of generated VectorObjects placed along the stroke.
 */
export const generateObjectsFromBrushStroke = (
    strokePoints: Point[], 
    layerSettings: LayerSettings,
    layerColor: string,
): VectorObject[] => {
    if (strokePoints.length < 2) return [];

    const {
        seed, brushPatternType, brushSize, brushDensity, brushScaleJitter, brushAngleJitter,
        wordText, wordMinFontSize, wordMaxFontSize, wordFontFamily, wordFontWeight,
        minCircleRadius, maxCircleRadius,
        strokeWidth,
        wordBrushGrowthMode,
    } = layerSettings;

    const random = mulberry32(seed);
    const newObjects: VectorObject[] = [];

    const totalLength = strokePoints.reduce((acc, p, i) => {
        if (i === 0) return 0;
        const p_prev = strokePoints[i-1];
        return acc + Math.sqrt((p[0] - p_prev[0])**2 + (p[1] - p_prev[1])**2);
    }, 0);
    
    // Spacing is inversely related to density
    const baseSpacing = (1.1 - brushDensity) * 20;
    
    for (let d = baseSpacing / 2; d < totalLength; d += baseSpacing) {
        const placement = getPointAtDistance(strokePoints, d);
        if (!placement) continue;

        const { point, angle } = placement;
        const jitteredAngle = angle + (random() - 0.5) * brushAngleJitter * 2;
        const scaleFactor = 1 - (random() * brushScaleJitter);
        
        // Offset perpendicular to the stroke direction
        const offsetAngle = (angle + 90) * Math.PI / 180;
        const offsetDistance = (random() - 0.5) * brushSize;
        const finalPoint: Point = [
            point[0] + Math.cos(offsetAngle) * offsetDistance,
            point[1] + Math.sin(offsetAngle) * offsetDistance
        ];
        
        const id = String(Date.now() + d + random());

        switch (brushPatternType) {
            case 'stipple':
            case 'circles': {
                const r = (minCircleRadius + (maxCircleRadius - minCircleRadius) * random()) * scaleFactor;
                if (r < 0.5) continue;
                const newCircle: ShapeObject = {
                    id,
                    type: 'shape',
                    shapeType: 'ellipse',
                    x: finalPoint[0] - r,
                    y: finalPoint[1] - r,
                    width: r * 2,
                    height: r * 2,
                    rotation: 0,
                    fill: layerColor,
                    stroke: 'none',
                    strokeWidth: 0,
                    skewX: 0,
                    skewY: 0,
                    opacity: 1,
                    fillOpacity: 1,
                    strokeOpacity: 1,
                    blendMode: 'normal'
                };
                newObjects.push(newCircle);
                break;
            }
            case 'words': {
                if (!wordText || !wordText.trim()) continue;
                const wordList = wordText.split(/\s+/).filter(Boolean);
                if (wordList.length === 0) continue;
                const word = wordList[Math.floor(random() * wordList.length)];
                
                let fontSize;
                const progression = d / totalLength; // 0 to 1 along the stroke

                if (wordBrushGrowthMode === 'grow') {
                    fontSize = wordMinFontSize + (wordMaxFontSize - wordMinFontSize) * progression;
                } else if (wordBrushGrowthMode === 'shrink') {
                    fontSize = wordMinFontSize + (wordMaxFontSize - wordMinFontSize) * (1 - progression);
                } else { // 'random' or default
                    fontSize = wordMinFontSize + (wordMaxFontSize - wordMinFontSize) * random();
                }

                fontSize *= scaleFactor; // Apply jitter

                if (fontSize < 2) continue;

                const { width, height } = measureText(word, fontSize, wordFontFamily, wordFontWeight);

                const newText: TextObject = {
                    id,
                    type: 'text',
                    x: finalPoint[0] - width / 2,
                    y: finalPoint[1] - height / 2,
                    width,
                    height,
                    text: word,
                    fontSize,
                    fontFamily: wordFontFamily,
                    fontWeight: wordFontWeight,
                    rotation: jitteredAngle,
                    fill: layerColor,
                    stroke: 'none',
                    strokeWidth: 0,
                    skewX: 0,
                    skewY: 0,
                    opacity: 1,
                    fillOpacity: 1,
                    strokeOpacity: 1,
                    blendMode: 'normal'
                };
                newObjects.push(newText);
                break;
            }
            case 'hatch': {
                const hatchLength = (brushSize / 5) * scaleFactor;
                const angleRad = jitteredAngle * Math.PI / 180;
                const dx = Math.cos(angleRad) * hatchLength / 2;
                const dy = Math.sin(angleRad) * hatchLength / 2;
                
                const x1 = finalPoint[0] - dx;
                const y1 = finalPoint[1] - dy;
                const x2 = finalPoint[0] + dx;
                const y2 = finalPoint[1] + dy;

                const newLine: LineObject = {
                    id,
                    type: 'line',
                    x1, y1, x2, y2,
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x1 - x2),
                    height: Math.abs(y1 - y2),
                    rotation: 0, // Rotation is baked into coordinates
                    fill: 'none',
                    stroke: layerColor,
                    strokeWidth: strokeWidth,
                    skewX: 0,
                    skewY: 0,
                    opacity: 1,
                    fillOpacity: 1,
                    strokeOpacity: 1,
                    blendMode: 'normal'
                };
                newObjects.push(newLine);
                break;
            }
        }
    }

    return newObjects;
};
