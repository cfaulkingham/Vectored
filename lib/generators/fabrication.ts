
import type { Point, PrimitivePatternData } from '../../types';
import { getSmoothedPolylinePath } from '../geometry';
import { mulberry32, type GeneratorContext } from './utils';

/**
 * Generates a Box Joint (Finger Joint) pattern for laser cutting.
 * Creates 6 panels (Front, Back, Left, Right, Top, Bottom) laid out flat.
 * Handles corner interference by prioritizing Front/Back panels for corners,
 * and recessing Top/Bottom and Left/Right panels accordingly.
 * 
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with box joint paths.
 */
export const generateBoxJoint = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { boxWidth, boxHeight, boxDepth, materialThickness, jointSize } = settings;
    
    const paths: string[] = [];
    // Conversion factor: mm to px (assuming 96 DPI)
    const mmToPx = 96 / 25.4;

    // Convert settings from mm to pixels
    const W = Math.max(materialThickness * 3, boxWidth) * mmToPx;
    const H = Math.max(materialThickness * 3, boxHeight) * mmToPx;
    const D = Math.max(materialThickness * 3, boxDepth) * mmToPx;
    const t = Math.max(0.1, materialThickness) * mmToPx;
    const s = Math.max(1, jointSize) * mmToPx;
    
    const spacing = 20; // Spacing between panels on canvas (pixels)
    
    // Helper to add points for a straight line
    const addLine = (pts: Point[], p1: Point, p2: Point) => {
        pts.push(p2);
    };

    // Helper to generate a finger joint edge
    const addJointEdge = (
        pts: Point[], 
        p1: Point, 
        p2: Point, 
        mode: 'tab' | 'slot', 
        startOffset: number, 
        endOffset: number
    ) => {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const totalLen = Math.sqrt(dx*dx + dy*dy);
        
        const ux = dx / totalLen;
        const uy = dy / totalLen;
        
        // Normal vector (90 deg clockwise relative to p1->p2), which is INWARD for a clockwise panel path
        const nx = -uy;
        const ny = ux;

        // A 'tab' should go outward (against the inward normal), a 'slot' should go inward (with the normal)
        const fingerDir = mode === 'tab' ? -1 : 1;
        
        const jointLen = totalLen - startOffset - endOffset;
        
        let numUnits = Math.floor(jointLen / s);
        if (numUnits % 2 === 0) numUnits--; 
        numUnits = Math.max(1, numUnits);
        
        const actualFingerSize = jointLen / numUnits;

        // Move to start of joint area
        if (startOffset > 0) {
            pts.push([p1[0] + ux * startOffset, p1[1] + uy * startOffset]);
        }

        let currDist = startOffset;
        
        for (let i = 0; i < numUnits; i++) {
            // A 'tab' edge starts with a tab, a 'slot' edge starts with a space to mate properly.
            const isFeature = mode === 'tab' ? (i % 2 === 0) : (i % 2 !== 0);
            
            if (isFeature) {
                // Draw the feature (Tab or Slot)
                const fX = nx * t * fingerDir;
                const fY = ny * t * fingerDir;
                
                const baseStart: Point = [p1[0] + ux * currDist, p1[1] + uy * currDist];
                const baseEnd: Point = [p1[0] + ux * (currDist + actualFingerSize), p1[1] + uy * (currDist + actualFingerSize)];
                
                const tipStart: Point = [baseStart[0] + fX, baseStart[1] + fY];
                const tipEnd: Point = [baseEnd[0] + fX, baseEnd[1] + fY];
                
                pts.push(tipStart);
                pts.push(tipEnd);
                pts.push(baseEnd);
            } else {
                // Just walk along the baseline
                const baseEnd: Point = [p1[0] + ux * (currDist + actualFingerSize), p1[1] + uy * (currDist + actualFingerSize)];
                pts.push(baseEnd);
            }
            
            currDist += actualFingerSize;
        }

        // Finish the line to p2
        pts.push(p2);
    };

    // Function to generate a closed panel polygon
    const createPanel = (
        w: number, h: number, 
        x: number, y: number,
        edges: {
            top: { mode: 'tab'|'slot'|'flat', marginStart: number, marginEnd: number },
            right: { mode: 'tab'|'slot'|'flat', marginStart: number, marginEnd: number },
            bottom: { mode: 'tab'|'slot'|'flat', marginStart: number, marginEnd: number },
            left: { mode: 'tab'|'slot'|'flat', marginStart: number, marginEnd: number },
        }
    ) => {
        const tl: Point = [x, y];
        const tr: Point = [x + w, y];
        const br: Point = [x + w, y + h];
        const bl: Point = [x, y + h];
        
        const pts: Point[] = [tl];
        
        // Top: TL -> TR
        if (edges.top.mode === 'flat') addLine(pts, tl, tr);
        else addJointEdge(pts, tl, tr, edges.top.mode, edges.top.marginStart, edges.top.marginEnd);
        
        // Right: TR -> BR
        if (edges.right.mode === 'flat') addLine(pts, tr, br);
        else addJointEdge(pts, tr, br, edges.right.mode, edges.right.marginStart, edges.right.marginEnd);
        
        // Bottom: BR -> BL
        if (edges.bottom.mode === 'flat') addLine(pts, br, bl);
        else addJointEdge(pts, br, bl, edges.bottom.mode, edges.bottom.marginStart, edges.bottom.marginEnd);
        
        // Left: BL -> TL
        if (edges.left.mode === 'flat') addLine(pts, bl, tl);
        else addJointEdge(pts, bl, tl, edges.left.mode, edges.left.marginStart, edges.left.marginEnd);
        
        return getSmoothedPolylinePath(pts, 0) + " Z";
    };

    let cx = bounds.x;
    let cy = bounds.y;

    const frontBackW = W;
    const frontBackH = H;
    
    const leftRightW = D - 2 * t;
    const leftRightH = H;
    
    const topBottomW = W - 2 * t;
    const topBottomD = D - 2 * t;

    // 1. Front Panel
    paths.push(createPanel(frontBackW, frontBackH, cx, cy, {
        top: { mode: 'slot', marginStart: t, marginEnd: t },
        right: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        bottom: { mode: 'slot', marginStart: t, marginEnd: t },
        left: { mode: 'tab', marginStart: 0, marginEnd: 0 }
    }));

    // 2. Back Panel
    paths.push(createPanel(frontBackW, frontBackH, cx + frontBackW + spacing, cy, {
        top: { mode: 'slot', marginStart: t, marginEnd: t },
        right: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        bottom: { mode: 'slot', marginStart: t, marginEnd: t },
        left: { mode: 'tab', marginStart: 0, marginEnd: 0 }
    }));

    cy += frontBackH + spacing;
    let row2X = bounds.x;

    // 3. Left Panel
    paths.push(createPanel(leftRightW, leftRightH, row2X, cy, {
        top: { mode: 'slot', marginStart: 0, marginEnd: 0 },
        right: { mode: 'slot', marginStart: 0, marginEnd: 0 },
        bottom: { mode: 'slot', marginStart: 0, marginEnd: 0 },
        left: { mode: 'slot', marginStart: 0, marginEnd: 0 }
    }));

    row2X += leftRightW + spacing;

    // 4. Right Panel
    paths.push(createPanel(leftRightW, leftRightH, row2X, cy, {
        top: { mode: 'slot', marginStart: 0, marginEnd: 0 },
        right: { mode: 'slot', marginStart: 0, marginEnd: 0 },
        bottom: { mode: 'slot', marginStart: 0, marginEnd: 0 },
        left: { mode: 'slot', marginStart: 0, marginEnd: 0 }
    }));

    cy += leftRightH + spacing;
    let row3X = bounds.x;

    // 5. Top Panel
    paths.push(createPanel(topBottomW, topBottomD, row3X, cy, {
        top: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        right: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        bottom: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        left: { mode: 'tab', marginStart: 0, marginEnd: 0 }
    }));

    row3X += topBottomW + spacing;

    // 6. Bottom Panel
    paths.push(createPanel(topBottomW, topBottomD, row3X, cy, {
        top: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        right: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        bottom: { mode: 'tab', marginStart: 0, marginEnd: 0 },
        left: { mode: 'tab', marginStart: 0, marginEnd: 0 }
    }));

    return { type: 'box-joint', paths };
};

/**
 * Generates a Living Hinge pattern, a series of cuts allowing rigid material to bend.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with living hinge cut paths.
 */
export const generateLivingHinge = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { livingHingeMargin, livingHingeCutLength, livingHingeGapSize, livingHingeLineSpacing, livingHingeOrientation } = settings;
    
    const paths: string[] = [];
    const margin = Math.max(0, livingHingeMargin);
    const innerWidth = bounds.width - margin * 2;
    const innerHeight = bounds.height - margin * 2;
    const startX = bounds.x + margin;
    const startY = bounds.y + margin;

    const cut = Math.max(1, livingHingeCutLength);
    const gap = Math.max(0.1, livingHingeGapSize);
    const spacing = Math.max(1, livingHingeLineSpacing);
    const cycle = cut + gap;

    if (livingHingeOrientation === 'vertical') {
        if (innerWidth <= 0 || innerHeight <= 0) return { type: 'living-hinge', paths: [] };
        
        const numLines = Math.floor(innerWidth / spacing);
        for (let i = 0; i <= numLines; i++) {
            const x = startX + i * spacing;
            const isStaggered = i % 2 !== 0;
            const staggerOffset = isStaggered ? -cycle / 2 : 0;
            
            for (let y = staggerOffset; y < innerHeight; y += cycle) {
                const startCutY = Math.max(0, y);
                const endCutY = Math.min(innerHeight, y + cut);
                if (endCutY > startCutY) {
                    paths.push(`M ${x},${startY + startCutY} L ${x},${startY + endCutY}`);
                }
            }
        }

    } else { // horizontal
        if (innerWidth <= 0 || innerHeight <= 0) return { type: 'living-hinge', paths: [] };
        
        const numLines = Math.floor(innerHeight / spacing);
        for (let i = 0; i <= numLines; i++) {
            const y = startY + i * spacing;
            const isStaggered = i % 2 !== 0;
            const staggerOffset = isStaggered ? -cycle / 2 : 0;

            for (let x = staggerOffset; x < innerWidth; x += cycle) {
                const startCutX = Math.max(0, x);
                const endCutX = Math.min(innerWidth, x + cut);
                if (endCutX > startCutX) {
                    paths.push(`M ${startX + startCutX},${y} L ${startX + endCutX},${y}`);
                }
            }
        }
    }
    
    return { type: 'living-hinge', paths };
};

/**
 * Generates a Jigsaw Puzzle pattern, creating interlocking puzzle pieces.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with jigsaw piece paths.
 */
export const generateJigsaw = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { jigsawColumns, jigsawRows, jigsawJitter, jigsawTabSize, jigsawRoundness } = settings;
    const offsetX = bounds.x;
    const offsetY = bounds.y;
    
    const cols = Math.max(2, jigsawColumns);
    const rows = Math.max(2, jigsawRows);
    const cellW = bounds.width / cols;
    const cellH = bounds.height / rows;
    const paths: string[] = [];

    type JigsawSegment = 
        | { type: 'L'; p: number[]; start: number[] }
        | { type: 'C'; p: number[]; start: number[]; cp1: number[]; cp2: number[] };

    const getEdgeSegments = (r: number, c: number, vertical: boolean): JigsawSegment[] => {
        let x1, y1, x2, y2;
        if (vertical) {
            x1 = offsetX + c * cellW; y1 = offsetY + r * cellH;
            x2 = x1; y2 = y1 + cellH;
        } else {
            x1 = offsetX + c * cellW; y1 = offsetY + r * cellH;
            x2 = x1 + cellW; y2 = y1;
        }

        const isBoundary = (vertical && (c === 0 || c === cols)) || (!vertical && (r === 0 || r === rows));
        if (isBoundary) {
            return [{ type: 'L', p: [x2, y2], start: [x1, y1] }];
        }

        const edgeId = vertical ? (c * rows + r) + 100000 : (r * cols + c); 
        const rng = mulberry32(settings.seed + edgeId);
        
        const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const flip = rng() > 0.5 ? 1 : -1;
        const jitter = jigsawJitter;
        const roundness = jigsawRoundness;

        const ux = (x2 - x1) / len;
        const uy = (y2 - y1) / len;
        const vx = -uy * flip;
        const vy = ux * flip;

        const toWorld = (u: number, v: number): number[] => [
            x1 + u * len * ux + v * len * vx,
            y1 + u * len * uy + v * len * vy
        ];

        const centerU = 0.5 + (rng() - 0.5) * jitter;
        
        const tabS = jigsawTabSize; 
        const neckW = tabS * (0.7 + (rng() - 0.5) * 0.2);
        const baseW = tabS * (1.1 + (rng() - 0.5) * 0.2);
        const headW = tabS * (1.5 + (rng() - 0.5) * 0.2);
        const height = tabS * (1.5 + (rng() - 0.5) * 0.2);
        
        const vNeck = height * 0.15; 
        const vHead = height;

        const uBaseL = centerU - baseW / 2;
        const uBaseR = centerU + baseW / 2;
        const uNeckL = centerU - neckW / 2;
        const uNeckR = centerU + neckW / 2;
        const uHeadL = centerU - headW / 2;
        const uHeadR = centerU + headW / 2;

        const pStart = [x1, y1];
        const pEnd = [x2, y2];
        const pShoulderL = toWorld(uBaseL, 0);
        const pNeckL = toWorld(uNeckL, vNeck);
        const pHeadL = toWorld(uHeadL, vHead);
        const pHeadR = toWorld(uHeadR, vHead);
        const pNeckR = toWorld(uNeckR, vNeck);
        const pShoulderR = toWorld(uBaseR, 0);

        const shoulderCPHeight = vNeck * 0.3 * (1 - roundness);
        const cp1_1 = toWorld(uBaseL + (uNeckL - uBaseL) * 0.3, shoulderCPHeight);
        const cp1_2 = toWorld(uNeckL - (uNeckL - uBaseL) * 0.3 * roundness, vNeck - (vNeck * 0.5 * roundness));

        const cp2_1 = toWorld(uNeckL - (uHeadL - uNeckL) * 0.1, vNeck + (vHead - vNeck) * 0.5);
        const cp2_2 = toWorld(uHeadL + (uHeadL - uNeckL) * 0.1, vHead - (vHead - vNeck) * 0.2);

        const cp3_1 = toWorld(uHeadL + (uHeadR - uHeadL) * 0.3, vHead + (headW * 0.5 * roundness));
        const cp3_2 = toWorld(uHeadR - (uHeadR - uHeadL) * 0.3, vHead + (headW * 0.5 * roundness));
        
        const cp4_1 = toWorld(uHeadR + (uNeckR - uHeadR) * 0.1, vHead - (vHead - vNeck) * 0.2);
        const cp4_2 = toWorld(uNeckR - (uNeckR - uHeadR) * 0.1, vNeck + (vHead - vNeck) * 0.5);

        const cp5_1 = toWorld(uNeckR + (uBaseR - uNeckR) * 0.3 * roundness, vNeck - (vNeck * 0.5 * roundness));
        const cp5_2 = toWorld(uBaseR - (uBaseR - uNeckR) * 0.3, shoulderCPHeight);

        const segments: JigsawSegment[] = [
            { type: 'L', p: pShoulderL, start: pStart },
            { type: 'C', p: pNeckL, start: pShoulderL, cp1: cp1_1, cp2: cp1_2 },
            { type: 'C', p: pHeadL, start: pNeckL, cp1: cp2_1, cp2: cp2_2 },
            { type: 'C', p: pHeadR, start: pHeadL, cp1: cp3_1, cp2: cp3_2 },
            { type: 'C', p: pNeckR, start: pHeadR, cp1: cp4_1, cp2: cp4_2 },
            { type: 'C', p: pShoulderR, start: pNeckR, cp1: cp5_1, cp2: cp5_2 },
            { type: 'L', p: pEnd, start: pShoulderR }
        ];

        if (roundness < 0.05) {
            return [
                 { type: 'L', p: pShoulderL, start: pStart },
                 { type: 'L', p: pNeckL, start: pShoulderL },
                 { type: 'L', p: pHeadL, start: pNeckL },
                 { type: 'L', p: pHeadR, start: pHeadL },
                 { type: 'L', p: pNeckR, start: pHeadR },
                 { type: 'L', p: pShoulderR, start: pNeckR },
                 { type: 'L', p: pEnd, start: pShoulderR }
            ];
        }

        return segments;
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = offsetX + c * cellW;
            const y = offsetY + r * cellH;
            
            let d = `M ${x} ${y}`;
            
            const edges = [
                { r, c, v: false, rev: false },      
                { r, c: c + 1, v: true, rev: false }, 
                { r: r + 1, c, v: false, rev: true }, 
                { r, c, v: true, rev: true }          
            ];

            for (const edge of edges) {
                const segments = getEdgeSegments(edge.r, edge.c, edge.v);
                
                if (edge.rev) {
                    for (let i = segments.length - 1; i >= 0; i--) {
                        const seg = segments[i];
                        const dest = seg.start;
                        if (seg.type === 'C') {
                            d += ` C ${seg.cp2[0]} ${seg.cp2[1]} ${seg.cp1[0]} ${seg.cp1[1]} ${dest[0]} ${dest[1]}`;
                        } else {
                            d += ` L ${dest[0]} ${dest[1]}`;
                        }
                    }
                } else {
                    for (const seg of segments) {
                        if (seg.type === 'C') {
                            d += ` C ${seg.cp1[0]} ${seg.cp1[1]} ${seg.cp2[0]} ${seg.cp2[1]} ${seg.p[0]} ${seg.p[1]}`;
                        } else {
                            d += ` L ${seg.p[0]} ${seg.p[1]}`;
                        }
                    }
                }
            }
            paths.push(d + ' Z');
        }
    }
    return { type: 'jigsaw', paths };
};

/**
 * Generates a Gear pattern.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings and bounds.
 * @returns {PrimitivePatternData} The generated pattern data with gear path.
 */
export const generateGears = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds } = ctx;
    const { gearTeeth, gearModule, gearPressureAngle, gearHoleRadius } = settings;
    
    const teeth = Math.max(3, Math.floor(gearTeeth));
    const module = Math.max(1, gearModule);
    const pressureAngleRad = (gearPressureAngle * Math.PI) / 180;
    
    const pitchDiameter = module * teeth;
    const baseDiameter = pitchDiameter * Math.cos(pressureAngleRad);
    const addendum = module;
    const dedendum = 1.25 * module;
    const outerDiameter = pitchDiameter + 2 * addendum;
    const rootDiameter = pitchDiameter - 2 * dedendum;
    
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    const points: Point[] = [];
    const stepsPerTooth = 16;
    const totalSteps = teeth * stepsPerTooth;
    
    for (let i = 0; i <= totalSteps; i++) {
        const angle = (i / totalSteps) * 2 * Math.PI;
        const stepInTooth = i % stepsPerTooth;
        const toothPhase = stepInTooth / stepsPerTooth;
        
        let r = pitchDiameter / 2;
        
        if (toothPhase < 0.2) {
            r = rootDiameter / 2;
        } else if (toothPhase < 0.35) {
            const t = (toothPhase - 0.2) / 0.15;
            r = (rootDiameter / 2) + (outerDiameter - rootDiameter) / 2 * t;
        } else if (toothPhase < 0.65) {
            r = outerDiameter / 2;
        } else if (toothPhase < 0.8) {
            const t = (toothPhase - 0.65) / 0.15;
            r = (outerDiameter / 2) - (outerDiameter - rootDiameter) / 2 * t;
        } else {
            r = rootDiameter / 2;
        }
        
        points.push([
            centerX + r * Math.cos(angle),
            centerY + r * Math.sin(angle)
        ]);
    }
    
    const gearPath = `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ') + ' Z';
    const holePath = gearHoleRadius > 0 ? `M ${centerX + gearHoleRadius} ${centerY} A ${gearHoleRadius} ${gearHoleRadius} 0 1 0 ${centerX - gearHoleRadius} ${centerY} A ${gearHoleRadius} ${gearHoleRadius} 0 1 0 ${centerX + gearHoleRadius} ${centerY} Z` : '';
    
    return { type: 'gears', paths: [gearPath + ' ' + holePath] };
};