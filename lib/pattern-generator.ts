

import type { LayerSettings, Point, PrimitivePatternData, VectorObject } from '../types';
import { mulberry32, getDensityMap, type DensityImageData, type GeneratorContext } from './generators/utils';
import * as fabrication from './generators/fabrication';
import * as geometric from './generators/geometric';
import * as organic from './generators/organic';
import * as distribution from './generators/distribution';
import * as maze from './generators/maze';

// Declare d3 for Delaunay (used in distribution setup)
declare const d3: any;

interface GeneratePatternOptions {
    patternSettings: LayerSettings;
    bounds: { x: number; y: number; width: number; height: number };
    densityImages?: Record<string, HTMLImageElement>;
    densityImageData?: Record<string, DensityImageData | null>;
    seed: number;
    objects: VectorObject[];
}

/**
 * Main function to generate vector patterns based on layer settings.
 * Dispatches to specific generators in lib/generators/ based on the pattern type.
 * Handles initial setup like point generation (with optional relaxation) and density map preparation.
 * 
 * @param options - Configuration options for generation including settings, bounds, and context data.
 * @returns PrimitivePatternData structure containing paths, circles, or other geometry, or null if generation failed.
 */
export const generatePattern = (options: GeneratePatternOptions): PrimitivePatternData => {
    const {
        patternSettings,
        bounds,
        densityImages,
        densityImageData,
        objects,
    } = options;

    if (bounds.width <= 0 || bounds.height <= 0) return null;
    if (patternSettings.patternType === 'none') return null;
    
    const random = mulberry32(patternSettings.seed);

    // Prepare Context
    const densityImage = (patternSettings.densityImageURL && densityImages) ? densityImages[patternSettings.densityImageURL] : null;
    const densityData = (patternSettings.densityImageURL && densityImageData) ? densityImageData[patternSettings.densityImageURL] : null;
    const densityMapInfo = getDensityMap(densityImage, densityData, bounds.width, bounds.height, patternSettings.densityImageInvert);

    // Generate points for distribution-based patterns
    const needsPoints = ['voronoi', 'circles', 'stipple', 'words', 'hatch'].includes(patternSettings.patternType);
    let points: Point[] = [];
    if (needsPoints) {
        const useDensityForPlacement = densityMapInfo && patternSettings.densityImageURL;
        
        if (useDensityForPlacement) {
            // Use density map for point distribution via rejection sampling
            const { map, width: mapW, height: mapH, offsetX, offsetY } = densityMapInfo;
            let attempts = 0;
            const maxAttempts = patternSettings.pointCount * 50; // Safety break for sparse images
            
            while (points.length < patternSettings.pointCount && attempts < maxAttempts) {
                const x = random() * bounds.width; // relative to bounds
                const y = random() * bounds.height; // relative to bounds
                
                // Map coordinates to density map
                const mapX = Math.floor(x - offsetX);
                const mapY = Math.floor(y - offsetY);

                let density = 0.0;
                if (mapX >= 0 && mapX < mapW && mapY >= 0 && mapY < mapH) {
                    density = map[mapY * mapW + mapX];
                }

                if (random() < density) {
                    points.push([x + bounds.x, y + bounds.y]);
                }
                attempts++;
            }
            // If rejection sampling is too slow/inefficient, fill the rest randomly.
            while (points.length < patternSettings.pointCount) {
                points.push([random() * bounds.width + bounds.x, random() * bounds.height + bounds.y]);
            }
        } else {
            // Original random distribution
            for (let i = 0; i < patternSettings.pointCount; i++) {
                points.push([random() * bounds.width + bounds.x, random() * bounds.height + bounds.y]);
            }
        }

        // Apply Lloyd's relaxation if requested
        if (patternSettings.relaxationIterations > 0 && points.length > 1) {
            const voronoiBounds: [number, number, number, number] = [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height];
            for (let i = 0; i < patternSettings.relaxationIterations; i++) {
                const delaunay = d3.Delaunay.from(points);
                const voronoi = delaunay.voronoi(voronoiBounds);
                points = points.map((p, j) => { 
                    const polygon = voronoi.cellPolygon(j); 
                    return polygon ? d3.polygonCentroid(polygon) : p; 
                });
            }
        }
    }

    const ctx: GeneratorContext = {
        settings: patternSettings,
        bounds,
        random,
        densityMap: densityMapInfo,
        points,
        objects
    };

    try {
        switch (patternSettings.patternType) {
            // Fabrication
            case 'box-joint': return fabrication.generateBoxJoint(ctx);
            case 'living-hinge': return fabrication.generateLivingHinge(ctx);
            case 'jigsaw': return fabrication.generateJigsaw(ctx);
            case 'gears': return fabrication.generateGears(ctx);
            
            // Maze
            case 'maze': return maze.generateMaze(ctx);

            // Geometric
            case 'spirograph': return geometric.generateSpirograph(ctx);
            case 'guilloche': return geometric.generateGuilloche(ctx);
            case 'rose-curve': return geometric.generateRoseCurve(ctx);
            case 'sine': return geometric.generateSine(ctx);
            case 'truchet': return geometric.generateTruchet(ctx);
            case 'glitch': return geometric.generateGlitch(ctx);
            case 'crosshatch': return geometric.generateCrosshatch(ctx);

            // Organic
            case 'flow-field': return organic.generateFlowField(ctx);
            case 'reaction-diffusion': return organic.generateReactionDiffusion(ctx);
            case 'lsystem': return organic.generateLSystem(ctx);
            case 'topo': return organic.generateTopo(ctx);

            // Distribution
            case 'voronoi': return distribution.generateVoronoi(ctx);
            case 'circles': return distribution.generateCircles(ctx);
            case 'stipple': return distribution.generateStipple(ctx);
            case 'halftone': return distribution.generateHalftone(ctx);
            case 'hatch': return distribution.generateHatch(ctx);
            case 'colonization': return distribution.generateColonization(ctx);
            case 'words': return distribution.generateWords(ctx);

            default: return null;
        }
    } catch (e) {
        console.error("Error generating pattern:", e);
        return null;
    }
};

/**
 * Wrapper for generatePattern to be used in Web Workers (if separate worker file logic is added later).
 * Currently an alias to the main generator.
 */
export const generatePatternForWorker = generatePattern;