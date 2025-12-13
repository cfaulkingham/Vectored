
import type { Point, PrimitivePatternData, FlowGuideObject } from '../types';
import { getSmoothedPolylinePath, distToSegmentSq } from '../geometry';
import { SimplexNoise, gaussianBlur } from './utils';
import type { GeneratorContext } from './utils';

// d3 required for contours and geoPath
declare const d3: any;

/**
 * Generates a Flow Field pattern, simulating fluid movement or wind.
 * Can be influenced by guide objects.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, random generator, and objects.
 * @returns {PrimitivePatternData} The generated pattern data with flow field paths.
 */
export const generateFlowField = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random, objects } = ctx;
    const { flowGridResolution, flowNoiseScale, flowLineCount, flowMaxSteps, flowStepLength, flowSmoothing } = settings;
    const resolution = Math.max(1, flowGridResolution);
    const cols = Math.floor(bounds.width / resolution) + 1;
    const rows = Math.floor(bounds.height / resolution) + 1;
    const field: number[] = new Array(cols * rows);
    const simplex = new SimplexNoise(random);

    const flowGuides = objects ? objects.filter(o => o.type === 'flow-guide') as FlowGuideObject[] : [];
    const hasGuides = flowGuides.length > 0;

    const maxInfluenceDist = flowGridResolution * 10;
    const maxInfluenceDistSq = maxInfluenceDist * maxInfluenceDist;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const gridPoint: Point = [x * resolution + bounds.x, y * resolution + bounds.y];
            
            const noiseAngle = simplex.noise2D(x * flowNoiseScale, y * flowNoiseScale) * Math.PI * 2;
            let finalAngle = noiseAngle;

            if (hasGuides) {
                let closestDistSq = Infinity;
                let guideAngle = 0;

                for (const guide of flowGuides) {
                    for (let i = 0; i < guide.points.length - 1; i++) {
                        const p1 = guide.points[i];
                        const p2 = guide.points[i + 1];
                        const dSq = distToSegmentSq(gridPoint, p1, p2);

                        if (dSq < closestDistSq) {
                            closestDistSq = dSq;
                            guideAngle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
                        }
                    }
                }

                if (closestDistSq < maxInfluenceDistSq) {
                    const blendFactor = 1.0 - Math.sqrt(closestDistSq) / maxInfluenceDist;
                    
                    const noiseVec: Point = [Math.cos(noiseAngle), Math.sin(noiseAngle)];
                    const guideVec: Point = [Math.cos(guideAngle), Math.sin(guideAngle)];
                    
                    const finalVec: Point = [
                        noiseVec[0] * (1 - blendFactor) + guideVec[0] * blendFactor,
                        noiseVec[1] * (1 - blendFactor) + guideVec[1] * blendFactor,
                    ];

                    finalAngle = Math.atan2(finalVec[1], finalVec[0]);
                }
            }
            
            field[y * cols + x] = finalAngle;
        }
    }

    const paths: string[] = [];
    for (let i = 0; i < flowLineCount; i++) {
        const particlePath: Point[] = [];
        let particle: Point = [random() * bounds.width, random() * bounds.height];
        
        for (let j = 0; j < flowMaxSteps; j++) {
            const [px, py] = particle;
            if (px < 0 || px > bounds.width || py < 0 || py > bounds.height) break;
            
            particlePath.push([px + bounds.x, py + bounds.y]);

            const col = Math.floor(px / resolution);
            const row = Math.floor(py / resolution);
            const gridIndex = row * cols + col;

            if (gridIndex >= 0 && gridIndex < field.length) {
                const angle = field[gridIndex];
                particle = [
                    px + Math.cos(angle) * flowStepLength,
                    py + Math.sin(angle) * flowStepLength
                ];
            } else {
                break; 
            }
        }

        if (particlePath.length > 1) {
            const svgPath = getSmoothedPolylinePath(particlePath, flowSmoothing);
            if (svgPath) paths.push(svgPath);
        }
    }

    return { type: 'flow-field', paths };
};

/**
 * Generates a Reaction-Diffusion pattern (Gray-Scott model).
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with reaction-diffusion contours.
 */
export const generateReactionDiffusion = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { rdIterations, rdFeed, rdKill, rdLineCount } = settings;
    
    const w = 128; const h = 128;
    let gridA = new Float32Array(w * h).fill(1);
    let gridB = new Float32Array(w * h).fill(0);

    const center = Math.floor(w / 2);
    const seedSize = 5;
    for (let y = center - seedSize; y < center + seedSize; y++) {
        for (let x = center - seedSize; x < center + seedSize; x++) {
            if (x > 0 && x < w && y > 0 && y < h) {
                gridB[y * w + x] = 1;
            }
        }
    }
    
    const dA = 1.0; const dB = 0.5; const dt = 1.0;

    const laplace = (grid: Float32Array, x: number, y: number): number => {
        let sum = 0;
        sum += grid[y * w + ((x + 1) % w)] * 0.2; // R
        sum += grid[y * w + ((x - 1 + w) % w)] * 0.2; // L
        sum += grid[((y + 1) % h) * w + x] * 0.2; // D
        sum += grid[((y - 1 + h) % h) * w + x] * 0.2; // U
        sum += grid[((y-1+h)%h) * w + ((x-1+w)%w)] * 0.05; // UL
        sum += grid[((y-1+h)%h) * w + ((x+1)%w)] * 0.05;   // UR
        sum += grid[((y+1)%h) * w + ((x-1+w)%w)] * 0.05;   // DL
        sum += grid[((y+1)%h) * w + ((x+1)%w)] * 0.05;   // DR
        sum -= grid[y * w + x];
        return sum;
    };

    for (let iter = 0; iter < rdIterations; iter++) {
        const nextA = new Float32Array(w * h);
        const nextB = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const a = gridA[i];
                const b = gridB[i];
                const abb = a * b * b;
                const laplaceA = laplace(gridA, x, y);
                const laplaceB = laplace(gridB, x, y);
                const newA = a + (dA * laplaceA - abb + rdFeed * (1 - a)) * dt;
                const newB = b + (dB * laplaceB + abb - (rdKill + rdFeed) * b) * dt;
                nextA[i] = Math.max(0, Math.min(1, newA));
                nextB[i] = Math.max(0, Math.min(1, newB));
            }
        }
        gridA = nextA;
        gridB = nextB;
    }

    const resultGrid = new Float32Array(w * h);
    for(let i=0; i<w*h; i++) { resultGrid[i] = gridA[i] - gridB[i]; }

    const contours = d3.contours().size([w, h]).thresholds(d3.range(0, 1, 1 / rdLineCount));
    const contourData = contours(resultGrid);
    
    const scaleX = bounds.width / w;
    const scaleY = bounds.height / h;
    
    contourData.forEach((contour: any) => {
        contour.coordinates = contour.coordinates.map((polygon: any) =>
            polygon.map((ring: any) =>
                ring.map((point: [number, number]) => [
                    point[0] * scaleX + bounds.x,
                    point[1] * scaleY + bounds.y,
                ])
            )
        );
    });

    const geoPath = d3.geoPath(d3.geoIdentity());
    const paths = contourData.map((c: any) => geoPath(c)).filter(Boolean) as string[];
    return { type: 'reaction-diffusion', paths };
};

/**
 * Generates an L-System pattern (fractal plants and curves).
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with L-System paths.
 */
export const generateLSystem = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { lsRules, lsAxiom, lsIterations, lsStep, lsAngle, lsSmoothing } = settings;
    
    const rules = new Map<string, string>();
    lsRules.split('\n').filter(Boolean).forEach(line => { const parts = line.split('->'); if (parts.length === 2) rules.set(parts[0].trim(), parts[1].trim()); });
    
    let current = lsAxiom;
    for (let i = 0; i < lsIterations; i++) { let next = ''; for (const char of current) { next += rules.get(char) || char; } current = next; }
    
    const turtle = { x: 0, y: 0, angle: -90, stack: [] as {x: number, y: number, angle: number}[] };
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    const DRAW_CHARS = ['F', 'f', 'G', 'A', 'B'];

    for (const char of current) {
        if (DRAW_CHARS.includes(char)) {
            const rad = turtle.angle * (Math.PI / 180);
            turtle.x += lsStep * Math.cos(rad);
            turtle.y += lsStep * Math.sin(rad);
            minX = Math.min(minX, turtle.x);
            minY = Math.min(minY, turtle.y);
            maxX = Math.max(maxX, turtle.x);
            maxY = Math.max(maxY, turtle.y);
        } else if (char === '+') {
            turtle.angle += lsAngle;
        } else if (char === '-') {
            turtle.angle -= lsAngle;
        } else if (char === '[') {
            turtle.stack.push({ x: turtle.x, y: turtle.y, angle: turtle.angle });
        } else if (char === ']') {
            if (turtle.stack.length > 0) Object.assign(turtle, turtle.stack.pop());
        }
    }

    const systemWidth = maxX - minX;
    const systemHeight = maxY - minY;
    const offsetX_ls = bounds.x + (bounds.width - systemWidth) / 2 - minX;
    const offsetY_ls = bounds.y + (bounds.height - systemHeight) / 2 - minY;

    const paths: string[] = [];
    let currentPoints: Point[] = [];

    turtle.x = 0;
    turtle.y = 0;
    turtle.angle = -90;
    turtle.stack = [];
    currentPoints.push([turtle.x + offsetX_ls, turtle.y + offsetY_ls]);

    const DRAW_AND_MOVE_CHARS = ['F', 'G', 'A', 'B'];

    for (const char of current) {
        if (DRAW_AND_MOVE_CHARS.includes(char)) {
            const rad = turtle.angle * (Math.PI / 180);
            const newX = turtle.x + lsStep * Math.cos(rad);
            const newY = turtle.y + lsStep * Math.sin(rad);
            turtle.x = newX;
            turtle.y = newY;
            currentPoints.push([newX + offsetX_ls, newY + offsetY_ls]);
        } else if (char === 'f') { 
            if (currentPoints.length > 1) {
                const path = getSmoothedPolylinePath(currentPoints, lsSmoothing);
                if (path) paths.push(path);
            }
            currentPoints = []; 
            const rad = turtle.angle * (Math.PI / 180);
            const newX = turtle.x + lsStep * Math.cos(rad);
            const newY = turtle.y + lsStep * Math.sin(rad);
            turtle.x = newX;
            turtle.y = newY;
            currentPoints.push([newX + offsetX_ls, newY + offsetY_ls]);
        } else if (char === '+') {
            turtle.angle += lsAngle;
        } else if (char === '-') {
            turtle.angle -= lsAngle;
        } else if (char === '[') { 
            turtle.stack.push({ x: turtle.x, y: turtle.y, angle: turtle.angle });
        } else if (char === ']') { 
            if (turtle.stack.length > 0) {
                if (currentPoints.length > 1) {
                    const path = getSmoothedPolylinePath(currentPoints, lsSmoothing);
                    if (path) paths.push(path);
                }
                currentPoints = []; 
                const popped = turtle.stack.pop();
                if (popped) Object.assign(turtle, popped);
                currentPoints.push([turtle.x + offsetX_ls, turtle.y + offsetY_ls]);
            }
        }
    }

    if (currentPoints.length > 1) {
        const path = getSmoothedPolylinePath(currentPoints, lsSmoothing);
        if (path) paths.push(path);
    }
    
    return { type: 'lsystem', paths };
};

/**
 * Generates a Topographic Map pattern using Perlin noise or a density map.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, random generator, and density map.
 * @returns {PrimitivePatternData | null} The generated pattern data with topographic contour paths, or null if density map is invalid.
 */
export const generateTopo = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random, densityMap } = ctx;
    const { topoBlur, topoLineCount, topoNoiseScale, topoNoise } = settings;
    
    let contourData: any;
    let geoPath: any;

    if (densityMap) { 
         let finalMap: Float32Array;
         const mapW = densityMap.width;
         const mapH = densityMap.height;

         if (mapW > 0 && mapH > 0) {
             finalMap = new Float32Array(densityMap.map.length);
             for(let i=0; i<densityMap.map.length; i++) finalMap[i] = densityMap.map[i] * 255;
             
             if (topoBlur > 0) {
                 finalMap = gaussianBlur(finalMap, mapW, mapH, topoBlur);
             }
             
             const contours = d3.contours().size([mapW, mapH]).thresholds(d3.range(5, 255, (255 - 5) / topoLineCount)).smooth(true);
             contourData = contours(finalMap);
             const customProjection = d3.geoIdentity().translate([bounds.x + densityMap.offsetX, bounds.y + densityMap.offsetY]);
             geoPath = d3.geoPath(customProjection);
         } else {
              return null; 
         }
    } else {
        const mapW = 128; const mapH = 128;
        const randomNoise = new Float32Array(mapW * mapH);
        for (let i = 0; i < randomNoise.length; i++) {
            randomNoise[i] = random() * 255;
        }
        const heightMap = gaussianBlur(randomNoise, mapW, mapH, topoNoiseScale);

        let finalMap = heightMap;
        if (topoBlur > 0) {
          finalMap = gaussianBlur(heightMap, mapW, mapH, topoBlur);
        }
        
        const contours = d3.contours().size([mapW, mapH]).thresholds(d3.range(5, 255, (255 - 5) / topoLineCount)).smooth(true);
        contourData = contours(finalMap);
        
        const scaleX = bounds.width / mapW;
        const scaleY = bounds.height / mapH;
        
        contourData.forEach((contour: any) => {
            contour.coordinates = contour.coordinates.map((polygon: any) =>
                polygon.map((ring: any) =>
                    ring.map((point: [number, number]) => [
                        point[0] * scaleX + bounds.x,
                        point[1] * scaleY + bounds.y,
                    ])
                )
            );
        });
        geoPath = d3.geoPath(d3.geoIdentity());
    }
    
    const addNoise = (coords: any[][]): any[][] => coords.map(point => [ point[0] + (random() - 0.5) * topoNoise, point[1] + (random() - 0.5) * topoNoise, ]);
    if (topoNoise > 0) { contourData.forEach((contour: any) => { contour.coordinates = contour.coordinates.map((polygon: any) => polygon.map((ring: any) => addNoise(ring))); }); }
    const paths = contourData.map((contour: any) => geoPath(contour)).filter(Boolean) as string[];
    return { type: 'topo', paths };
};
