
import type { Point, PrimitivePatternData } from '../../types';
import { rotatePoint, getSmoothedPolylinePath } from '../geometry';
import type { GeneratorContext } from './utils';

import * as d3 from 'd3';

/**
 * Generates a Voronoi diagram pattern based on the provided points and bounds.
 *
 * @param {GeneratorContext} ctx - The generator context containing points, bounds, and other settings.
 * @returns {PrimitivePatternData | null} The generated pattern data with Voronoi cell paths, or null if no points are provided.
 */
export const generateVoronoi = (ctx: GeneratorContext): PrimitivePatternData => {
    const { points, bounds } = ctx;
    if (!points || points.length === 0) return null;
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height]);
    const paths = points.map((_, i) => voronoi.renderCell(i)).filter(Boolean) as string[];
    return { type: 'voronoi', paths };
};

/**
 * Generates a packed circle pattern (Circle Packing) based on points and density map.
 *
 * @param {GeneratorContext} ctx - The generator context containing points, settings, density map, and bounds.
 * @returns {PrimitivePatternData | null} The generated pattern data with circles, or null if insufficient points.
 */
export const generateCircles = (ctx: GeneratorContext): PrimitivePatternData => {
    const { points, settings, densityMap, bounds } = ctx;
    const { circlePacking, minCircleRadius, maxCircleRadius } = settings;
    if (!points || points.length < 2) return null;
    
    const delaunay = d3.Delaunay.from(points);
    const circles = points.map((p, i) => {
        const neighbors = Array.from(delaunay.neighbors(i)) as number[];
        if (neighbors.length === 0) return null;
        let minDistanceSq = Infinity;
        for (const neighborIndex of neighbors) { const n = points[neighborIndex]; const dx = p[0] - n[0]; const dy = p[1] - n[1]; const distSq = dx * dx + dy * dy; if (distSq < minDistanceSq) minDistanceSq = distSq; }
        if (minDistanceSq === Infinity) return null;
        
        let densityFactor = 1;
        if (densityMap) {
            const imgX = Math.round(p[0] - bounds.x - densityMap.offsetX);
            const imgY = Math.round(p[1] - bounds.y - densityMap.offsetY);
            if (imgX >= 0 && imgX < densityMap.width && imgY >= 0 && imgY < densityMap.height) {
                densityFactor = densityMap.map[imgY * densityMap.width + imgX];
            }
        }

        const calculatedRadius = (Math.sqrt(minDistanceSq) / 2) * circlePacking * densityFactor;
        const r = Math.max(minCircleRadius, Math.min(maxCircleRadius, calculatedRadius));
        return r > 0 ? { cx: p[0], cy: p[1], r } : null;
    }).filter(Boolean) as { cx: number, cy: number, r: number }[];
    return { type: 'circles', circles };
};

/**
 * Generates a Stipple pattern where circle sizes are influenced by a density map or random distribution.
 *
 * @param {GeneratorContext} ctx - The generator context containing points, settings, density map, bounds, and random generator.
 * @returns {PrimitivePatternData | null} The generated pattern data with stipple circles, or null if no points.
 */
export const generateStipple = (ctx: GeneratorContext): PrimitivePatternData => {
    const { points, settings, densityMap, bounds, random } = ctx;
    const { radiusDistribution, minCircleRadius, maxCircleRadius } = settings;
    if (!points) return null;

    const circles = points.map(p => {
        let density = 0.5;
        
        if (densityMap) {
            const imgX = Math.round(p[0] - bounds.x - densityMap.offsetX);
            const imgY = Math.round(p[1] - bounds.y - densityMap.offsetY);
            if (imgX >= 0 && imgX < densityMap.width && imgY >= 0 && imgY < densityMap.height) {
                density = densityMap.map[imgY * densityMap.width + imgX];
            } else {
                density = 0.1;
            }
        } else {
            density = 0.5 + (random() - 0.5) * 0.2;
        }
        
        if (radiusDistribution !== 1) {
            density = Math.pow(density, radiusDistribution);
        }
        
        const r = minCircleRadius + (maxCircleRadius - minCircleRadius) * density;
        
        return r > 0.5 ? { cx: p[0], cy: p[1], r } : null;
    }).filter(Boolean) as { cx: number, cy: number, r: number }[];
    
    return { type: 'stipple', circles };
};

/**
 * Generates a Halftone pattern, creating a grid of circles whose sizes are determined by a density map or distance from center.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, and density map.
 * @returns {PrimitivePatternData} The generated pattern data with halftone circles.
 */
export const generateHalftone = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, densityMap } = ctx;
    const { gridSpacing, radiusDistribution, minCircleRadius, maxCircleRadius } = settings;
    
    const spacing = Math.max(5, gridSpacing);
    const circles: { cx: number, cy: number, r: number }[] = [];
    
    const cols = Math.floor(bounds.width / spacing);
    const rows = Math.floor(bounds.height / spacing);
    
    const startX = bounds.x + (bounds.width - cols * spacing) / 2 + spacing/2;
    const startY = bounds.y + (bounds.height - rows * spacing) / 2 + spacing/2;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const px = startX + x * spacing;
            const py = startY + y * spacing;
            
            let density = 0.5;
            
            if (densityMap) {
                const imgX = Math.round(px - bounds.x - densityMap.offsetX);
                const imgY = Math.round(py - bounds.y - densityMap.offsetY);
                if (imgX >= 0 && imgX < densityMap.width && imgY >= 0 && imgY < densityMap.height) {
                    density = densityMap.map[imgY * densityMap.width + imgX];
                } else {
                    density = 0; 
                }
            } else {
                const cx = bounds.x + bounds.width / 2;
                const cy = bounds.y + bounds.height / 2;
                const maxDist = Math.min(bounds.width, bounds.height) / 2;
                const d = Math.sqrt((px - cx)**2 + (py - cy)**2);
                density = 1 - Math.min(1, d / maxDist);
            }
            
            if (radiusDistribution !== 1) {
                density = Math.pow(density, radiusDistribution);
            }
            
            const r = minCircleRadius + (maxCircleRadius - minCircleRadius) * density;
            
            if (r > 0.5) {
                circles.push({ cx: px, cy: py, r });
            }
        }
    }
    return { type: 'halftone', circles };
};

/**
 * Generates a Hatch pattern (lines) within Voronoi cells.
 *
 * @param {GeneratorContext} ctx - The generator context containing points, bounds, settings, and random generator.
 * @returns {PrimitivePatternData | null} The generated pattern data with hatch paths, or null if no points.
 */
export const generateHatch = (ctx: GeneratorContext): PrimitivePatternData => {
    const { points, bounds, settings, random } = ctx;
    const { hatchSpacing, hatchAngleRandomness, hatchCurviness } = settings;
    if (!points || points.length === 0) return null;
    
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height]);

    const paths: string[] = [];

    for (let i = 0; i < points.length; i++) {
        const polygon = voronoi.cellPolygon(i);
        if (!polygon || polygon.length < 3) continue;

        const centroid = d3.polygonCentroid(polygon);
        
        const angleDeg = (random() - 0.5) * 180 * hatchAngleRandomness;
        const angleRad = angleDeg * Math.PI / 180;

        const rotatedPolygon = polygon.map((p: [number, number]) => rotatePoint(p, centroid, -angleRad));

        const minY = Math.min(...rotatedPolygon.map((p: any) => p[1]));
        const maxY = Math.max(...rotatedPolygon.map((p: any) => p[1]));

        for (let y = minY; y <= maxY; y += hatchSpacing) {
            const intersections: number[] = [];
            for (let j = 0; j < rotatedPolygon.length; j++) {
                const p1 = rotatedPolygon[j];
                const p2 = rotatedPolygon[(j + 1) % rotatedPolygon.length];
                if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
                    const x = (y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]) + p1[0];
                    intersections.push(x);
                }
            }

            intersections.sort((a, b) => a - b);
            
            for (let k = 0; k < intersections.length; k += 2) {
                if (k + 1 < intersections.length) {
                    let p1_rot: Point = [intersections[k], y];
                    let p2_rot: Point = [intersections[k+1], y];

                    if (Math.abs(p1_rot[0] - p2_rot[0]) < 0.1) continue;

                    if (hatchCurviness > 0) {
                        const midX = (p1_rot[0] + p2_rot[0]) / 2;
                        const midY = y + (random() - 0.5) * hatchSpacing * hatchCurviness;

                        const p1_orig = rotatePoint(p1_rot, centroid, angleRad);
                        const p2_orig = rotatePoint(p2_rot, centroid, angleRad);
                        const mid_orig = rotatePoint([midX, midY], centroid, angleRad);
                        paths.push(`M ${p1_orig[0]} ${p1_orig[1]} Q ${mid_orig[0]} ${mid_orig[1]} ${p2_orig[0]} ${p2_orig[1]}`);

                    } else {
                        const p1_orig = rotatePoint(p1_rot, centroid, angleRad);
                        const p2_orig = rotatePoint(p2_rot, centroid, angleRad);
                        paths.push(`M ${p1_orig[0]} ${p1_orig[1]} L ${p2_orig[0]} ${p2_orig[1]}`);
                    }
                }
            }
        }
    }

    return { type: 'hatch', paths };
};

/**
 * Generates a Words pattern, placing text at random locations.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, points, and random generator.
 * @returns {PrimitivePatternData | null} The generated pattern data with words, or null if invalid input.
 */
export const generateWords = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, points, random } = ctx;
    const { wordText, wordFontSizeDistribution, wordMinFontSize, wordMaxFontSize, wordFontFamily, wordFontWeight, wordRotation } = settings;
    if (!wordText.trim() || !points) return null;
    
    const wordList = wordText.split(/\s+/).filter(Boolean);
    if (wordList.length === 0) return null;
    
    return { 
        type: 'words', 
        words: points.map(p => { 
            const rF = random(); 
            const cF = Math.pow(rF, wordFontSizeDistribution); 
            const word = wordList[Math.floor(random() * wordList.length)]; 
            return { 
                text: word, 
                lines: [word], 
                x: p[0], 
                y: p[1], 
                fontSize: wordMinFontSize + cF * (wordMaxFontSize - wordMinFontSize), 
                fontFamily: wordFontFamily, 
                fontWeight: wordFontWeight, 
                rotation: (random() - 0.5) * 2 * wordRotation 
            }; 
        }) 
    };
};

/**
 * Generates a Colonization pattern, simulating space colonization algorithm.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, and random generator.
 * @returns {PrimitivePatternData | null} The generated pattern data with colonization paths, or null if failure.
 */
export const generateColonization = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random } = ctx;
    const { colonizationAttractionPoints, colonizationRoots, colonizationInfluenceRadius, colonizationKillRadius, colonizationIterations, colonizationBranchLength, colonizationWaviness, colonizationSmoothing } = settings;
    const isInShape = (p: Point) => p[0] >= 0 && p[0] <= bounds.width && p[1] >= 0 && p[1] <= bounds.height;

    let attractors: Point[] = [];
    let attempts = 0; const maxAttempts = colonizationAttractionPoints * 100;
    while (attractors.length < colonizationAttractionPoints && attempts < maxAttempts) {
        const p: Point = [random() * bounds.width, random() * bounds.height];
        if (isInShape(p)) { attractors.push(p); }
        attempts++;
    }
    if (attractors.length === 0) return null;

    const nodes: { pos: Point; parentIndex: number | null; growthDir: Point; growthCount: number }[] = [];
    for (let i = 0; i < colonizationRoots; i++) {
        nodes.push({ pos: [ (bounds.width / (colonizationRoots + 1)) * (i+1) , bounds.height], parentIndex: null, growthDir: [0, 0], growthCount: 0 });
    }

    const influenceRadiusSq = colonizationInfluenceRadius * colonizationInfluenceRadius;
    const killRadiusSq = colonizationKillRadius * colonizationKillRadius;
    const distSq = (p1: Point, p2: Point) => (p1[0] - p2[0])**2 + (p1[1] - p2[1])**2;

    for (let iter = 0; iter < colonizationIterations; iter++) {
        for (const attractor of attractors) {
            let closestNodeIndex = -1;
            let minDistanceSq = Infinity;
            for (let i = 0; i < nodes.length; i++) {
                const dSq = distSq(attractor, nodes[i].pos);
                if (dSq < minDistanceSq && dSq < influenceRadiusSq) {
                    minDistanceSq = dSq;
                    closestNodeIndex = i;
                }
            }
            if (closestNodeIndex !== -1) {
                const closestNode = nodes[closestNodeIndex];
                const dir: Point = [attractor[0] - closestNode.pos[0], attractor[1] - closestNode.pos[1]];
                closestNode.growthDir[0] += dir[0];
                closestNode.growthDir[1] += dir[1];
                closestNode.growthCount++;
            }
        }

        const currentNodes = [...nodes];
        for (let i = 0; i < currentNodes.length; i++) {
            const node = currentNodes[i];
            if (node.growthCount > 0) {
                const avgDir = node.growthDir;
                const len = Math.sqrt(avgDir[0] * avgDir[0] + avgDir[1] * avgDir[1]);
                if (len > 0) {
                    const normalizedDir: Point = [avgDir[0] / len, avgDir[1] / len];
                    
                    const randX = (random() - 0.5) * colonizationWaviness;
                    const randY = (random() - 0.5) * colonizationWaviness;
                    const finalDir: Point = [normalizedDir[0] + randX, normalizedDir[1] + randY];
                    const finalLen = Math.sqrt(finalDir[0]**2 + finalDir[1]**2);
                    if(finalLen > 0) {
                        finalDir[0] /= finalLen;
                        finalDir[1] /= finalLen;
                    }

                    const newNodePos: Point = [
                        node.pos[0] + finalDir[0] * colonizationBranchLength,
                        node.pos[1] + finalDir[1] * colonizationBranchLength
                    ];
                    nodes.push({ pos: newNodePos, parentIndex: i, growthDir: [0, 0], growthCount: 0 });
                }
                node.growthDir = [0, 0];
                node.growthCount = 0;
            }
        }

        attractors = attractors.filter(attractor => {
            let minDistanceSq = Infinity;
             for (const node of nodes) {
                const dSq = distSq(attractor, node.pos);
                if (dSq < minDistanceSq) {
                    minDistanceSq = dSq;
                }
            }
            return minDistanceSq > killRadiusSq;
        });

        if (attractors.length === 0) break;
    }

    const paths: string[] = [];
    const parentIndices = new Set(nodes.map(n => n.parentIndex).filter(i => i !== null));
    const leafNodeIndices = nodes.map((_, i) => i).filter(i => !parentIndices.has(i) && nodes[i].parentIndex !== null);

    for (const leafIndex of leafNodeIndices) {
        let currentPoints: Point[] = [];
        let currentIndex: number | null = leafIndex;
        while (currentIndex !== null && nodes[currentIndex]) {
            currentPoints.push([nodes[currentIndex].pos[0] + bounds.x, nodes[currentIndex].pos[1] + bounds.y]);
            currentIndex = nodes[currentIndex].parentIndex;
        }
        currentPoints.reverse(); 
        if (currentPoints.length > 1) {
            const path = getSmoothedPolylinePath(currentPoints, colonizationSmoothing);
            if (path) paths.push(path);
        }
    }

    return { type: 'colonization', paths };
};
