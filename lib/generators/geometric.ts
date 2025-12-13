
import type { Point, PrimitivePatternData } from '../types';
import { getSmoothedPolylinePath } from '../geometry';
import type { GeneratorContext } from './utils';

// d3 required for rose-curve path generation
declare const d3: any;

/**
 * Generates a Spirograph pattern (Hypotrochoid).
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with spirograph paths.
 */
export const generateSpirograph = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { spirographrRatio, spirographdRatio, spirographLaps } = settings;
    const paths: string[] = [];
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const R = Math.min(bounds.width, bounds.height) / 2 * 0.9;
    
    const r = R * spirographrRatio;
    const d = r * spirographdRatio;
    const maxT = 2 * Math.PI * spirographLaps;
    const step = 0.05;

    const pts: Point[] = [];
    for (let t = 0; t <= maxT; t += step) {
        const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
        const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
        pts.push([cx + x, cy + y]);
    }
    if (pts.length > 2) {
        if (Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1]) > 1) {
            pts.push(pts[0]);
        }
        const path = getSmoothedPolylinePath(pts, 0);
        if (path) paths.push(path);
    }

    return { type: 'spirograph', paths };
};

/**
 * Generates a Guilloche pattern, complex geometric patterns often used in banknotes.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with guilloche paths.
 */
export const generateGuilloche = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { guillocheAmplitude1, guillocheFrequency1, guillocheAmplitude2, guillocheFrequency2, guillocheLaps } = settings;
    const paths: string[] = [];
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const R = Math.min(bounds.width, bounds.height) / 2 * 0.8;
    
    const maxT = 2 * Math.PI * guillocheLaps;
    const step = 0.02;
    
    const pts: Point[] = [];
    
    for (let t = 0; t <= maxT; t += step) {
        const r = R + R * guillocheAmplitude1 * Math.sin(guillocheFrequency1 * t) + R * guillocheAmplitude2 * Math.cos(guillocheFrequency2 * t);
        const x = r * Math.cos(t);
        const y = r * Math.sin(t);
        pts.push([cx + x, cy + y]);
    }
    
    if (pts.length > 2) {
        pts.push(pts[0]);
        const path = getSmoothedPolylinePath(pts, 0);
        if (path) paths.push(path);
    }
    
    return { type: 'guilloche', paths };
};

/**
 * Generates a Rose Curve pattern (Rhodonea curve).
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with rose curve paths.
 */
export const generateRoseCurve = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { roseN, roseD, roseKMax } = settings;
    const paths: string[] = [];
    const curvePoints: Point[] = [];
    const centerX = bounds.width / 2 + bounds.x;
    const centerY = bounds.height / 2 + bounds.y;
    const maxRadius = Math.min(bounds.width, bounds.height) / 2 * 0.9;

    for (let k = 0; k <= roseKMax; k++) {
        const theta = k * (Math.PI / 180) * roseD;
        const r = maxRadius * Math.sin(roseN * theta);
        const x = centerX + r * Math.cos(theta);
        const y = centerY + r * Math.sin(theta);
        curvePoints.push([x, y]);
    }

    if (curvePoints.length > 1) {
        const lineGenerator = d3.line().x((p: Point) => p[0]).y((p: Point) => p[1]);
        paths.push(lineGenerator(curvePoints));
    }

    return { type: 'rose-curve', paths };
};

/**
 * Generates a Sine Wave pattern, optionally modulated by a density map or secondary frequency.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, and density map.
 * @returns {PrimitivePatternData | null} The generated pattern data with sine wave paths, or null if wave count is invalid.
 */
export const generateSine = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, densityMap } = ctx;
    const { sineWaveCount, sineFrequency, sineAmplitude, sineThickness, sineThicknessVariation, sineThicknessFrequency } = settings;
    if (sineWaveCount <= 0) return null;

    const paths: string[] = [];
    const mapW = densityMap?.width || 0;
    const mapH = densityMap?.height || 0;
    
    for (let i = 0; i < sineWaveCount; i++) {
         const centerY = bounds.y + (bounds.height / (sineWaveCount + 1)) * (i + 1);
         const topPoints: Point[] = [];
         const bottomPoints: Point[] = [];
         
         const step = 2;
         for(let x = 0; x <= bounds.width; x += step) {
             const xPos = bounds.x + x;
             const yOffset = Math.sin(x * sineFrequency) * sineAmplitude;
             let currentThickness = sineThickness;
             
             if (densityMap) {
                 const imgX = Math.round(x - densityMap.offsetX);
                 const imgY = Math.round(centerY - bounds.y - densityMap.offsetY); 
                 if (imgX >= 0 && imgX < mapW && imgY >= 0 && imgY < mapH) {
                     const val = densityMap.map[imgY * mapW + imgX];
                     currentThickness = val * sineThickness;
                 }
             } else {
                 const variation = Math.sin(x * sineThicknessFrequency) * sineThicknessVariation;
                 currentThickness = Math.max(0.5, sineThickness + variation);
             }
             
             topPoints.push([xPos, centerY + yOffset - currentThickness / 2]);
             bottomPoints.push([xPos, centerY + yOffset + currentThickness / 2]);
         }
         
         if (topPoints.length > 1) {
             let d = `M ${topPoints[0][0]} ${topPoints[0][1]}`;
             for(let k=1; k<topPoints.length; k++) d += ` L ${topPoints[k][0]} ${topPoints[k][1]}`;
             for(let k=bottomPoints.length-1; k>=0; k--) d += ` L ${bottomPoints[k][0]} ${bottomPoints[k][1]}`;
             d += " Z";
             paths.push(d);
         }
    }
    return { type: 'sine', paths };
};

/**
 * Generates a Truchet Tile pattern.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, density map, and random generator.
 * @returns {PrimitivePatternData} The generated pattern data with truchet tile paths.
 */
export const generateTruchet = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random, densityMap } = ctx;
    const { truchetTileSize, truchetVariant, truchetMinTileSize } = settings;
    const paths: string[] = [];
    const ts = Math.max(1, truchetTileSize);
    const cols = Math.ceil(bounds.width / ts);
    const rows = Math.ceil(bounds.height / ts);
    const mapW = densityMap?.width || 0;
    const mapH = densityMap?.height || 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x_local = c * ts;
            const y_local = r * ts;
            let currentSize = ts;

            if (densityMap) {
                const cx_local = x_local + ts / 2;
                const cy_local = y_local + ts / 2;
                const imgX = Math.round(cx_local - densityMap.offsetX);
                const imgY = Math.round(cy_local - densityMap.offsetY);

                let darkness = 0.5;
                if (imgX >= 0 && imgX < mapW && imgY >= 0 && imgY < mapH) {
                    darkness = densityMap.map[imgY * mapW + imgX];
                }
                currentSize = truchetMinTileSize + darkness * (ts - truchetMinTileSize);
            }
            
            if (currentSize < 0.1) continue;

            const offset_local = (ts - currentSize) / 2;
            const tx = x_local + offset_local + bounds.x;
            const ty = y_local + offset_local + bounds.y;

            if (truchetVariant === 'arcs') {
                const orientation = Math.floor(random() * 2);
                const half = currentSize / 2;
                if (orientation === 0) { 
                     paths.push(`M ${tx} ${ty} L ${tx + half} ${ty} A ${half} ${half} 0 0 1 ${tx} ${ty + half} Z`);
                     paths.push(`M ${tx+currentSize} ${ty+currentSize} L ${tx+currentSize} ${ty+half} A ${half} ${half} 0 0 1 ${tx+half} ${ty+currentSize} Z`);
                } else { 
                    paths.push(`M ${tx+currentSize} ${ty} L ${tx+half} ${ty} A ${half} ${half} 0 0 1 ${tx+currentSize} ${ty+half} Z`);
                    paths.push(`M ${tx} ${ty+currentSize} L ${tx+half} ${ty+currentSize} A ${half} ${half} 0 0 1 ${tx} ${ty+half} Z`);
                }
            } else if (truchetVariant === 'diagonal') {
                const orientation = Math.floor(random() * 2);
                if (orientation === 0) {
                    paths.push(`M ${tx} ${ty} L ${tx + currentSize} ${ty} L ${tx + currentSize} ${ty + currentSize} Z`);
                } else {
                    paths.push(`M ${tx} ${ty} L ${tx} ${ty + currentSize} L ${tx + currentSize} ${ty + currentSize} Z`);
                }
            } else if (truchetVariant === 'cross') {
                const orientation = Math.floor(random() * 2);
                const tcx = tx + currentSize / 2;
                const tcy = ty + currentSize / 2;
                if (orientation === 0) {
                    paths.push(`M ${tx} ${ty} L ${tcx} ${tcy} L ${tx} ${ty + currentSize} Z`);
                    paths.push(`M ${tx + currentSize} ${ty} L ${tcx} ${tcy} L ${tx + currentSize} ${ty + currentSize} Z`);
                } else {
                    paths.push(`M ${tx} ${ty} L ${tcx} ${tcy} L ${tx + currentSize} ${ty} Z`);
                    paths.push(`M ${tx} ${ty + currentSize} L ${tcx} ${tcy} L ${tx + currentSize} ${ty + currentSize} Z`);
                }
            }
        }
    }
    return { type: 'truchet', paths };
};

/**
 * Generates a Glitch pattern with random rectangles and lines.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, and random generator.
 * @returns {PrimitivePatternData} The generated pattern data with glitch paths.
 */
export const generateGlitch = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random } = ctx;
    const { glitchRectCount, glitchLineCount, glitchDisplacement } = settings;
    const paths: string[] = [];
    
    for (let i = 0; i < glitchRectCount; i++) {
        const w = (random() * random()) * (bounds.width / 3);
        const h = (random() * random()) * (bounds.height / 8);
        const x = random() * bounds.width + bounds.x;
        const y = random() * bounds.height + bounds.y;
        const dx = (random() - 0.5) * glitchDisplacement;
        const dy = (random() - 0.5) * glitchDisplacement;
        paths.push(`M ${x+dx} ${y+dy} h ${w} v ${h} h ${-w} Z`);
    }
    for (let i = 0; i < glitchLineCount; i++) {
        const x1 = random() * bounds.width + bounds.x;
        const y1 = random() * bounds.height + bounds.y;
        const length = random() * (bounds.width / 5);
        const angle = (Math.floor(random() * 4) / 2) * Math.PI + (random() - 0.5) * 0.1;
        const x2 = x1 + Math.cos(angle) * length;
        const y2 = y1 + Math.sin(angle) * length;
        const dx = (random() - 0.5) * glitchDisplacement;
        const dy = (random() - 0.5) * glitchDisplacement;
        paths.push(`M ${x1+dx} ${y1+dy} L ${x2+dx} ${y2+dy}`);
    }
    
    return { type: 'glitch', paths };
};

/**
 * Generates a Crosshatch pattern, optionally modulated by a density map.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, density map, and random generator.
 * @returns {PrimitivePatternData} The generated pattern data with crosshatch paths.
 */
export const generateCrosshatch = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random, densityMap } = ctx;
    const { hatchAngle1, hatchSpacing1, hatchAngle2, hatchSpacing2, hatchJitter, hatchDensityStrength } = settings;
    
    const paths: string[] = [];
    const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
    const centerX = bounds.width / 2 + bounds.x;
    const centerY = bounds.height / 2 + bounds.y;
    const mapW = densityMap?.width || 0;
    const mapH = densityMap?.height || 0;

    const generateLines = (angleDeg: number, spacing: number) => {
        if (spacing <= 0) return;
        const angleRad = angleDeg * Math.PI / 180;
        const perpendicularAngleRad = angleRad + Math.PI / 2;
        
        if (densityMap) {
            let distanceAlongPerp = -diagonal / 2;
            while(distanceAlongPerp < diagonal / 2) {
                const lineCenterX_local = distanceAlongPerp * Math.cos(perpendicularAngleRad);
                const lineCenterY_local = distanceAlongPerp * Math.sin(perpendicularAngleRad);

                const imgX = Math.round(lineCenterX_local + bounds.width/2 - densityMap.offsetX);
                const imgY = Math.round(lineCenterY_local + bounds.height/2 - densityMap.offsetY);

                let darkness = 0.5;
                if (imgX >= 0 && imgX < mapW && imgY >= 0 && imgY < mapH) {
                    darkness = densityMap.map[imgY * mapW + imgX];
                }
                
                const currentSpacing = Math.max(1, spacing / (0.1 + darkness * hatchDensityStrength));

                const jitteredDistance = distanceAlongPerp + (random() - 0.5) * hatchJitter * currentSpacing;
                const jitteredAngleRad = angleRad + (random() - 0.5) * hatchJitter * (Math.PI / 180) * 5;

                const finalLineCenterX = centerX + jitteredDistance * Math.cos(perpendicularAngleRad);
                const finalLineCenterY = centerY + jitteredDistance * Math.sin(perpendicularAngleRad);

                const dx = (diagonal / 2) * Math.cos(jitteredAngleRad);
                const dy = (diagonal / 2) * Math.sin(jitteredAngleRad);
                
                paths.push(`M ${finalLineCenterX - dx},${finalLineCenterY - dy} L ${finalLineCenterX + dx},${finalLineCenterY + dy}`);

                distanceAlongPerp += currentSpacing;
            }
        } else {
            const numLines = Math.ceil(diagonal / spacing);
            for (let i = 0; i < numLines; i++) {
                const distanceAlongPerp = (i * spacing) - (diagonal / 2);
                
                const jitteredDistance = distanceAlongPerp + (random() - 0.5) * hatchJitter * spacing;
                const jitteredAngleRad = angleRad + (random() - 0.5) * hatchJitter * (Math.PI / 180) * 5;

                const lineCenterX = centerX + jitteredDistance * Math.cos(perpendicularAngleRad);
                const lineCenterY = centerY + jitteredDistance * Math.sin(perpendicularAngleRad);

                const dx = (diagonal / 2) * Math.cos(jitteredAngleRad);
                const dy = (diagonal / 2) * Math.sin(jitteredAngleRad);

                const startX = lineCenterX - dx;
                const startY = lineCenterY - dy;
                const endX = lineCenterX + dx;
                const endY = lineCenterY + dy;
                
                paths.push(`M ${startX},${startY} L ${endX},${endY}`);
            }
        }
    };
    
    generateLines(hatchAngle1, hatchSpacing1);
    generateLines(hatchAngle2, hatchSpacing2);

    return { type: 'crosshatch', paths };
};
