
import type { Point, PolygonVertex, ResizeHandle, VectorObject, ShapeType, MirrorMode, PolygonObject, PathObject, LineObject, Layer, GenericPathObject, ShapeObject, FlowGuideObject, TextObject, ImageObject, GroupObject, MeasurementObject } from '../types';
// FIX: Re-export transformPathData to make it available to other modules.
import { transformPathData as _transformPathData } from './svg-parser';
export const transformPathData = _transformPathData;

// Ensure DOMMatrix / DOMPoint exist in all environments (browser, worker, node/vitest)
class FallbackDOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length >= 6) {
            [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
    }
    translateSelf(tx = 0, ty = 0) {
        this.e += this.a * tx + this.c * ty;
        this.f += this.b * tx + this.d * ty;
        return this;
    }
    scaleSelf(sx = 1, sy = sx) {
        this.a *= sx;
        this.b *= sx;
        this.c *= sy;
        this.d *= sy;
        return this;
    }
    rotateSelf(deg = 0) {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const a = this.a * cos + this.c * sin;
        const b = this.b * cos + this.d * sin;
        const c = this.a * -sin + this.c * cos;
        const d = this.b * -sin + this.d * cos;
        this.a = a; this.b = b; this.c = c; this.d = d;
        return this;
    }
    skewXSelf(deg = 0) {
        const tan = Math.tan((deg * Math.PI) / 180);
        this.a += this.c * tan;
        this.b += this.d * tan;
        return this;
    }
    skewYSelf(deg = 0) {
        const tan = Math.tan((deg * Math.PI) / 180);
        this.c += this.a * tan;
        this.d += this.b * tan;
        return this;
    }
    inverse() {
        const det = this.a * this.d - this.b * this.c;
        if (det === 0) return new FallbackDOMMatrix();
        const inv = new FallbackDOMMatrix();
        inv.a = this.d / det;
        inv.b = -this.b / det;
        inv.c = -this.c / det;
        inv.d = this.a / det;
        inv.e = (this.c * this.f - this.d * this.e) / det;
        inv.f = (this.b * this.e - this.a * this.f) / det;
        return inv;
    }
    transformPoint(point: { x: number; y: number }) {
        return {
            x: point.x * this.a + point.y * this.c + this.e,
            y: point.x * this.b + point.y * this.d + this.f,
        };
    }
}

class FallbackDOMPoint {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    matrixTransform(matrix: any) {
        if (typeof matrix.transformPoint === 'function') {
            const res = matrix.transformPoint(this);
            return new FallbackDOMPoint(res.x, res.y);
        }
        const x = this.x * (matrix.a ?? 1) + this.y * (matrix.c ?? 0) + (matrix.e ?? 0);
        const y = this.x * (matrix.b ?? 0) + this.y * (matrix.d ?? 1) + (matrix.f ?? 0);
        return new FallbackDOMPoint(x, y);
    }
}

if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = FallbackDOMMatrix;
}
if (typeof globalThis.DOMPoint === 'undefined') {
    (globalThis as any).DOMPoint = FallbackDOMPoint;
}

/**
 * Adds two 2D points together vector-wise.
 * @param p1 - The first point [x, y].
 * @param p2 - The second point [x, y].
 * @returns The resulting point [x1+x2, y1+y2].
 */
export const add = (p1: Point, p2: Point): Point => [p1[0] + p2[0], p1[1] + p2[1]];

/**
 * Subtracts the second point from the first vector-wise.
 * @param p1 - The target point [x, y].
 * @param p2 - The point to subtract [x, y].
 * @returns The resulting point [x1-x2, y1-y2].
 */
export const sub = (p1: Point, p2: Point): Point => [p1[0] - p2[0], p1[1] - p2[1]];

/**
 * Scales a point by a scalar value.
 * @param p - The point to scale [x, y].
 * @param s - The scalar multiplier.
 * @returns The resulting scaled point [x*s, y*s].
 */
export const scale = (p: Point, s: number): Point => [p[0] * s, p[1] * s];

/**
 * Calculates the dot product of two points (vectors).
 * @param p1 - The first point.
 * @param p2 - The second point.
 * @returns The dot product scalar.
 */
export const dot = (p1: Point, p2: Point): number => p1[0] * p2[0] + p1[1] * p2[1];

/**
 * Rotates a point around a given center by a specified angle.
 * @param point - The point to rotate.
 * @param center - The center point of rotation.
 * @param angleRad - The angle of rotation in radians.
 * @returns The new coordinates of the rotated point.
 */
export const rotatePoint = (point: Point, center: Point, angleRad: number): Point => {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const translated = sub(point, center);
    const rotated: Point = [
        translated[0] * cos - translated[1] * sin,
        translated[0] * sin + translated[1] * cos,
    ];
    return add(rotated, center);
};

/**
 * Calculates the full transformation matrix for an object using the browser's DOMMatrix.
 * Handles translation, rotation, skew, and flipping (scale).
 * @param obj - The vector object containing position, dimensions, and transform properties.
 * @returns A DOMMatrix representing the object's transformation.
 */
export const getTransformMatrix = (obj: {x: number, y: number, width: number, height: number, rotation: number, skewX?: number, skewY?: number, flipX?: boolean, flipY?: boolean}): DOMMatrix => {
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    const matrix = new DOMMatrix();
    
    // Apply transformations relative to center
    // Order corresponds to SVG: transform="translate(...) rotate(...) skew(...) scale(...)"
    // DOMMatrix operations are applied in reverse order (pre-multiplied) or forward if using standard multiplication.
    // Methods like translateSelf, rotateSelf apply a new matrix on the right: M = M * T.
    // So first call is applied LAST to the point.
    // Wait, standard web matrix usage:
    // P' = M * P.
    // If we want: translate(cx, cy) * rotate * skew * scale * translate(-cx, -cy) * P
    // We should call them in that order on an identity matrix.
    
    matrix.translateSelf(cx, cy);
    matrix.rotateSelf(obj.rotation);
    if (obj.skewX) matrix.skewXSelf(obj.skewX);
    if (obj.skewY) matrix.skewYSelf(obj.skewY);
    if (obj.flipX) matrix.scaleSelf(-1, 1);
    if (obj.flipY) matrix.scaleSelf(1, -1);
    matrix.translateSelf(-cx, -cy);
    
    return matrix;
};

/**
 * Transforms a 2D point using a DOMMatrix.
 * @param point - The point to transform [x, y].
 * @param matrix - The transformation matrix to apply.
 * @returns The transformed point [x, y].
 */
export const transformPoint = (point: Point, matrix: DOMMatrix): Point => {
    const p = new DOMPoint(point[0], point[1]);
    const transformed = p.matrixTransform(matrix);
    return [transformed.x, transformed.y];
};

/**
 * Calculates the squared distance between two points.
 * Useful for distance comparisons without the square root overhead.
 * @param p1 - The first point.
 * @param p2 - The second point.
 * @returns The squared distance.
 */
export const distSq = (p1: Point, p2: Point): number => (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2;

/**
 * Calculates the squared distance from a point to the closest point on a line segment defined by a and b.
 * @param p - The point to measure from.
 * @param a - The start point of the segment.
 * @param b - The end point of the segment.
 * @returns The squared distance to the segment.
 */
export const distToSegmentSq = (p: Point, a: Point, b: Point): number => {
    const l2 = distSq(a, b);
    if (l2 === 0) return distSq(p, a);
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    const closestPoint: Point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    return distSq(p, closestPoint);
}

/**
 * Calculates the area of a polygon defined by vertices using the Shoelace formula.
 * @param points - The vertices of the polygon.
 * @returns The area.
 */
export const calculatePolygonArea = (points: Point[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i][0] * points[j][1];
        area -= points[j][0] * points[i][1];
    }
    return Math.abs(area / 2);
};

/**
 * Calculates the perimeter of a polygon defined by vertices.
 * @param points - The vertices of the polygon.
 * @param isClosed - Whether the polygon is closed (adds last segment).
 * @returns The total perimeter.
 */
export const calculatePolygonPerimeter = (points: Point[], isClosed: boolean): number => {
    if (points.length < 2) return 0;
    let perimeter = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i+1][0] - points[i][0];
        const dy = points[i+1][1] - points[i][1];
        perimeter += Math.sqrt(dx*dx + dy*dy);
    }
    if (isClosed && points.length > 2) {
        const dx = points[0][0] - points[points.length-1][0];
        const dy = points[0][1] - points[points.length-1][1];
        perimeter += Math.sqrt(dx*dx + dy*dy);
    }
    return perimeter;
};

/**
 * Calculates the bounding box (min/max x and y) for a set of PolygonVertex objects.
 * @param points - An array of polygon vertices.
 * @returns An object containing x, y, width, and height.
 */
export const calculatePolygonBounds = (points: PolygonVertex[]): { x: number, y: number, width: number, height: number } => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const anchors = points.map(p => p.anchor);
    const minX = Math.min(...anchors.map(p => p[0]));
    const minY = Math.min(...anchors.map(p => p[1]));
    const maxX = Math.max(...anchors.map(p => p[0]));
    const maxY = Math.max(...anchors.map(p => p[1]));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Calculates the bounding box for a simple array of Points.
 * @param points - An array of [x, y] points.
 * @returns An object containing x, y, width, and height.
 */
export const calculatePathBounds = (points: Point[]): { x: number, y: number, width: number, height: number } => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1]));
    const maxX = Math.max(...points.map(p => p[0]));
    const maxY = Math.max(...points.map(p => p[1]));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Calculates the axis-aligned bounding box that encompasses a group of vector objects.
 * Takes object transformations (rotation, skew) into account.
 * @param objects - The array of objects to measure.
 * @returns The bounding box { x, y, width, height }.
 */
export const calculateGroupBounds = (objects: VectorObject[]): { x: number; y: number; width: number; height: number; } => {
    if (objects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let allPoints: Point[] = [];
    objects.forEach(obj => {
        if (obj.type === 'path-group' || obj.type === 'measurement') {
            const groupBounds = getObjectVisualBounds(obj);
            allPoints.push([groupBounds.x, groupBounds.y]);
            allPoints.push([groupBounds.x + groupBounds.width, groupBounds.y + groupBounds.height]);
            return;
        }
        
        const matrix = getTransformMatrix(obj);
        
        const corners: Point[] = [
            [obj.x, obj.y],
            [obj.x + obj.width, obj.y],
            [obj.x + obj.width, obj.y + obj.height],
            [obj.x, obj.y + obj.height]
        ];
        
        const transformedCorners = corners.map(p => transformPoint(p, matrix));
        allPoints.push(...transformedCorners);
    });

    if (allPoints.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const minX = Math.min(...allPoints.map(p => p[0]));
    const minY = Math.min(...allPoints.map(p => p[1]));
    const maxX = Math.max(...allPoints.map(p => p[0]));
    const maxY = Math.max(...allPoints.map(p => p[1]));

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Parses coordinates from an SVG path data string to determine its bounding box.
 * Uses browser's native getBBox for accuracy, falls back to coordinate parsing if needed.
 * @param d - The SVG path data string.
 * @returns The bounding box { x, y, width, height }.
 */
export const calculateGenericPathBounds = (d: string): { x: number, y: number, width: number, height: number } => {
    if (!d || d.trim() === '') return { x: 0, y: 0, width: 0, height: 0 };

    try {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0';
        tempSvg.style.height = '0';
        
        const pathMeasureElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathMeasureElement.setAttribute('d', d);
        
        tempSvg.appendChild(pathMeasureElement);
        document.body.appendChild(tempSvg);
        
        const rect = pathMeasureElement.getBBox();
        document.body.removeChild(tempSvg);

        // Sanity check for zero-size rects
        if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0) {
             // Check if path really is empty/zero
             const hasCommands = /[a-zA-Z]/.test(d);
             if (hasCommands && d.length > 10) throw new Error("Bounds likely failed");
        }
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    } catch (e) {
        // Fallback to simple coordinate extraction
        const matches = d.matchAll(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
        const coords: number[] = [];
        for (const match of matches) {
            coords.push(parseFloat(match[0]));
        }
        if (coords.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < coords.length; i += 2) {
            const x = coords[i];
            const y = coords[i + 1];
            if (!isNaN(x)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
            }
            if (!isNaN(y)) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
        
        if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
};

/**
 * Parses a D3-style Voronoi path string (M L L Z) into an array of Points.
 * @param d - The path data string.
 * @returns Array of vertices [x, y].
 */
export const parseVoronoiPathToPoints = (d: string): Point[] => {
    // Assumes d3 format: "M x,y L x,y L x,y Z"
    const parts = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/);
    const points: Point[] = [];
    for (let i = 0; i < parts.length; i++) {
        const coordPair = parts[i].split(',');
        if (coordPair.length === 2) {
            const x = parseFloat(coordPair[0]);
            const y = parseFloat(coordPair[1]);
            if (!isNaN(x) && !isNaN(y)) {
                points.push([x, y]);
            }
        }
    }
    return points;
}

/**
 * Calculates the position of a specific resize handle (e.g., 'top-left') for a vector object.
 * Applies object transformations to return the visual coordinates of the handle.
 * @param obj - The vector object.
 * @param handle - The name of the resize handle.
 * @returns The world position of the handle.
 */
export const getObjectHandlePosition = (obj: VectorObject, handle: ResizeHandle): Point => {
    const matrix = getTransformMatrix(obj);
    let localPointX: number, localPointY: number;

    if (handle.includes('left')) localPointX = obj.x;
    else if (handle.includes('right')) localPointX = obj.x + obj.width;
    else localPointX = obj.x + obj.width / 2;

    if (handle.includes('top')) localPointY = obj.y;
    else if (handle.includes('bottom')) localPointY = obj.y + obj.height;
    else localPointY = obj.y + obj.height / 2;
    
    return transformPoint([localPointX, localPointY], matrix);
};

/**
 * Calculates the local position of a layer manipulation handle.
 * @param handle - The handle type (e.g., 'top-left').
 * @param width - Layer width.
 * @param height - Layer height.
 * @returns The [x, y] position relative to the layer's origin.
 */
export const getLayerHandlePosition = (handle: ResizeHandle, width: number, height: number): Point => {
    let x: number, y: number;
    if (handle.includes('left')) x = 0;
    else if (handle.includes('right')) x = width;
    else x = width / 2;
    if (handle.includes('top')) y = 0;
    else if (handle.includes('bottom')) y = height;
    else y = height / 2;
    return [x, y];
}

/**
 * Generates an SVG path data string from a set of PolygonVertex objects, including cubic Bézier curves.
 * @param points - The array of vertices containing anchor and control points.
 * @param closed - Whether to close the path (Z command).
 * @returns The SVG path string.
 */
export const getPolygonPathWithCurves = (points: PolygonVertex[], closed: boolean): string => {
    if (!points || points.length < 1) return '';
    let path = `M ${points[0].anchor.join(',')}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i], p2 = points[i+1];
        path += ` C ${p1.handle2.join(',')} ${p2.handle1.join(',')} ${p2.anchor.join(',')}`;
    }
    if (closed && points.length > 2) {
        const pLast = points[points.length-1], pFirst = points[0];
        path += ` C ${pLast.handle2.join(',')} ${pFirst.handle1.join(',')} ${pFirst.anchor.join(',')}`;
        path += ' Z';
    }
    return path;
};

/**
 * Generates an SVG path string for a polyline, with optional smoothing using Catmull-Rom splines.
 * @param points - Array of points.
 * @param smoothing - Factor for smoothing (0 = linear, >0 = curved).
 * @returns The SVG path string or null if insufficient points.
 */
export const getSmoothedPolylinePath = (points: Point[], smoothing: number): string | null => {
    if (points.length < 2) return null;
    if (smoothing <= 0) {
        return `M ${points[0][0]},${points[0][1]} ` + points.slice(1).map(p => `L ${p[0]},${p[1]}`).join(' ');
    }

    // Jitter reduction: apply iterative moving average filter based on smoothing strength
    let smoothPoints = points.map(p => [...p] as Point);
    // Increase max iterations for stronger effect
    const iterations = Math.round(smoothing * 15);
    
    for (let iter = 0; iter < iterations; iter++) {
        const nextPoints = [...smoothPoints];
        for (let i = 1; i < smoothPoints.length - 1; i++) {
            const pPrev = smoothPoints[i - 1];
            const pCurr = smoothPoints[i];
            const pNext = smoothPoints[i + 1];
            nextPoints[i] = [
                0.25 * pPrev[0] + 0.5 * pCurr[0] + 0.25 * pNext[0],
                0.25 * pPrev[1] + 0.5 * pCurr[1] + 0.25 * pNext[1]
            ];
        }
        smoothPoints = nextPoints;
    }

    if (smoothPoints.length < 3) {
        return `M ${smoothPoints[0][0]},${smoothPoints[0][1]} ` + smoothPoints.slice(1).map(p => `L ${p[0]},${p[1]}`).join(' ');
    }

    // Generate Catmull-Rom spline converted to cubic bézier
    let path = `M ${smoothPoints[0][0]} ${smoothPoints[0][1]}`;
    
    for (let i = 0; i < smoothPoints.length - 1; i++) {
        const p0 = smoothPoints[Math.max(0, i - 1)];
        const p1 = smoothPoints[i];
        const p2 = smoothPoints[i + 1];
        const p3 = smoothPoints[Math.min(smoothPoints.length - 1, i + 2)];

        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;

        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

        path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`;
    }

    return path;
}

/**
 * Helper to generate vertices for predefined shapes (rectangle, star, etc.).
 * @param type - The shape type.
 * @param width - Bounding width.
 * @param height - Bounding height.
 * @param pointCount - Resolution for curves (e.g., circles).
 * @param cornerRadius - Corner radius for rectangles.
 * @returns Array of points defining the shape contour.
 */
const getShapeAsPolygonPoints = (type: ShapeType, width: number, height: number, pointCount: number = 32, cornerRadius: number = 0): Point[] => {
    const cx = width / 2;
    const cy = height / 2;
    const points: Point[] = [];

    switch (type) {
        case 'rectangle':
            if (cornerRadius > 0) {
                const r = Math.min(cornerRadius, width / 2, height / 2);
                const stepsPerCorner = Math.max(2, Math.floor(pointCount / 4));
                
                // Top Right
                for (let i = 0; i <= stepsPerCorner; i++) {
                    const angle = -Math.PI / 2 + (i / stepsPerCorner) * (Math.PI / 2);
                    points.push([width - r + r * Math.cos(angle), r + r * Math.sin(angle)]);
                }
                // Bottom Right
                for (let i = 0; i <= stepsPerCorner; i++) {
                    const angle = 0 + (i / stepsPerCorner) * (Math.PI / 2);
                    points.push([width - r + r * Math.cos(angle), height - r + r * Math.sin(angle)]);
                }
                // Bottom Left
                for (let i = 0; i <= stepsPerCorner; i++) {
                    const angle = Math.PI / 2 + (i / stepsPerCorner) * (Math.PI / 2);
                    points.push([r + r * Math.cos(angle), height - r + r * Math.sin(angle)]);
                }
                // Top Left
                for (let i = 0; i <= stepsPerCorner; i++) {
                    const angle = Math.PI + (i / stepsPerCorner) * (Math.PI / 2);
                    points.push([r + r * Math.cos(angle), r + r * Math.sin(angle)]);
                }
                return points;
            }
            return [[0, 0], [width, 0], [width, height], [0, height]];
        case 'ellipse': {
            const rx = width / 2;
            const ry = height / 2;
            for (let i = 0; i < pointCount; i++) {
                const angle = (i / pointCount) * 2 * Math.PI;
                points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
            }
            return points;
        }
        case 'triangle':
            return [[cx, 0], [width, height], [0, height]];
        case 'diamond':
            return [[cx, 0], [width, cy], [cx, height], [0, cy]];
        case 'pentagon': {
            const radius = Math.min(width, height) / 2;
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - (Math.PI / 2);
                points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
            }
            return points;
        }
        case 'hexagon': {
            const halfW = width / 2;
            const quarterW = width / 4;
            const halfH = height / 2;
            return [[quarterW, 0], [halfW + quarterW, 0], [width, halfH], [halfW + quarterW, height], [quarterW, height], [0, halfH]];
        }
        case 'octagon': {
            const radiusX = width / 2;
            const radiusY = height / 2;
            for (let i = 0; i < 8; i++) {
                const angle = (i * 2 * Math.PI / 8) - (Math.PI / 8);
                points.push([cx + radiusX * Math.cos(angle), cy + radiusY * Math.sin(angle)]);
            }
            return points;
        }
        case 'star': {
            const outerRadius = Math.min(width, height) / 2;
            const innerRadius = outerRadius * 0.4;
            const spikes = 5;
            let rot = Math.PI / 2 * 3;
            const step = Math.PI / spikes;
            for (let i = 0; i < spikes; i++) {
                points.push([cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius]);
                rot += step;
                points.push([cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius]);
                rot += step;
            }
            return points;
        }
        case 'heart': {
            for (let i = 0; i < pointCount; i++) {
                const t = (i / pointCount) * 2 * Math.PI;
                const x = 16 * Math.pow(Math.sin(t), 3);
                const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
                const normX = (x + 16) / 32;
                const normY = (y + 16) / 32;
                points.push([normX * width, (1 - normY) * height * 0.95 + height * 0.05]);
            }
            return points;
        }
        case 'moon': {
            const w = width, h = height;
            const outerRadiusX = w / 2;
            const outerRadiusY = h / 2;
            const innerRadiusX = w * 0.35;
            const innerRadiusY = h * 0.5;
            for (let i = 0; i <= pointCount / 2; i++) {
                const angle = Math.PI / 2 + (i / (pointCount / 2)) * Math.PI;
                points.push([cx + outerRadiusX * Math.cos(angle), cy + outerRadiusY * Math.sin(angle)]);
            }
            for (let i = pointCount / 2; i >= 0; i--) {
                const angle = Math.PI / 2 + (i / (pointCount / 2)) * Math.PI;
                points.push([cx + w * 0.15 + innerRadiusX * Math.cos(angle), cy + innerRadiusY * Math.sin(angle)]);
            }
            return points;
        }
        case 'arrow': {
            const bodyWidth = width * 0.5;
            const bodyHeight = height * 0.4;
            const bodyY = (height - bodyHeight) / 2;
            return [[bodyWidth, 0], [width, cy], [bodyWidth, height], [bodyWidth, bodyY + bodyHeight], [0, bodyY + bodyHeight], [0, bodyY], [bodyWidth, bodyY]];
        }
        case 'cross': {
            const armThickness = Math.min(width, height) / 3;
            const h_arm_y_start = (height - armThickness) / 2;
            const v_arm_x_start = (width - armThickness) / 2;
            return [
                [v_arm_x_start, 0], [v_arm_x_start + armThickness, 0], [v_arm_x_start + armThickness, h_arm_y_start],
                [width, h_arm_y_start], [width, h_arm_y_start + armThickness], [v_arm_x_start + armThickness, h_arm_y_start + armThickness],
                [v_arm_x_start + armThickness, height], [v_arm_x_start, height], [v_arm_x_start, h_arm_y_start + armThickness],
                [0, h_arm_y_start + armThickness], [0, h_arm_y_start], [v_arm_x_start, h_arm_y_start]
            ];
        }
        case 'ring': {
            const outerRx = width / 2;
            const outerRy = height / 2;
            const innerRatio = 0.6; // Must match getShapePath
            const innerRx = outerRx * innerRatio;
            const innerRy = outerRy * innerRatio;

            const allPoints: Point[] = [];

            // Outer ring, clockwise
            for (let i = 0; i <= pointCount; i++) {
                const angle = (i / pointCount) * 2 * Math.PI;
                allPoints.push([cx + outerRx * Math.cos(angle), cy + outerRy * Math.sin(angle)]);
            }

            // Inner ring, counter-clockwise to define the hole correctly for clipping algorithms
            for (let i = pointCount; i >= 0; i--) {
                const angle = (i / pointCount) * 2 * Math.PI;
                allPoints.push([cx + innerRx * Math.cos(angle), cy + innerRy * Math.sin(angle)]);
            }

            return allPoints;
        }
        default:
            return [[0, 0], [width, 0], [width, height], [0, height]];
    }
};

/**
 * Generates an SVG path definition string for a given shape type and dimensions.
 * @param type - The type of shape (rectangle, ellipse, etc.).
 * @param width - The width of the shape.
 * @param height - The height of the shape.
 * @param cornerRadius - Corner radius for rectangles.
 * @returns The SVG 'd' attribute string.
 */
export const getShapePath = (type: ShapeType, width: number, height: number, cornerRadius: number = 0): string => {
  const cx = width / 2;
  const cy = height / 2;
  let path = '';
  switch (type) {
    case 'rectangle': {
        if (cornerRadius > 0) {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            path = `M ${r} 0 h ${width - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${height - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h ${-(width - 2 * r)} a ${r} ${r} 0 0 1 -${r} -${r} v ${-(height - 2 * r)} a ${r} ${r} 0 0 1 ${r} -${r} Z`;
        } else {
            path = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
        }
        break;
    }
    case 'ellipse': {
        const rx = width / 2;
        const ry = height / 2;
        path = `M ${cx} ${cy-ry} a ${rx} ${ry} 0 1 0 0 ${2*ry} a ${rx} ${ry} 0 1 0 0 ${-2*ry} Z`;
        break;
    }
    case 'triangle': {
        path = `M ${cx} 0 L ${width} ${height} L 0 ${height} Z`;
        break;
    }
    case 'diamond': {
        const points = [[cx, 0], [width, cy], [cx, height], [0, cy]];
        path = `M ${points[0].join(' ')} L ${points.slice(1).map(p => p.join(' ')).join(' L ')} Z`;
        break;
    }
    case 'pentagon': {
        const points: Point[] = [];
        const radius = Math.min(width, height) / 2;
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI / 5) - (Math.PI / 2);
            points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
        path = `M ${points[0].join(' ')} L ${points.slice(1).map(p => p.join(' ')).join(' L ')} Z`;
        break;
    }
    case 'hexagon': {
        const halfW = width / 2;
        const quarterW = width / 4;
        const halfH = height / 2;
        const points: Point[] = [[quarterW, 0], [halfW + quarterW, 0], [width, halfH], [halfW + quarterW, height], [quarterW, height], [0, halfH]];
        path = `M ${points[0].join(' ')} L ${points.slice(1).map(p => p.join(' ')).join(' L ')} Z`;
        break;
    }
    case 'octagon': {
        const points: Point[] = [];
        const radiusX = width / 2;
        const radiusY = height / 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i * 2 * Math.PI / 8) - (Math.PI / 8);
            points.push([cx + radiusX * Math.cos(angle), cy + radiusY * Math.sin(angle)]);
        }
        path = `M ${points[0].join(' ')} L ${points.slice(1).map(p => p.join(' ')).join(' L ')} Z`;
        break;
    }
    case 'star': {
      const outerRadius = Math.min(width, height) / 2;
      const innerRadius = outerRadius * 0.4;
      const spikes = 5;
      let rot = Math.PI / 2 * 3;
      let step = Math.PI / spikes;
      path = `M ${cx} ${cy - outerRadius}`;
      for (let i = 0; i < spikes; i++) {
        path += ` L ${cx + Math.cos(rot) * outerRadius} ${cy + Math.sin(rot) * outerRadius}`;
        rot += step;
        path += ` L ${cx + Math.cos(rot) * innerRadius} ${cy + Math.sin(rot) * innerRadius}`;
        rot += step;
      }
      path += ' Z';
      break;
    }
    case 'heart': {
       const w = width, h = height;
       path = `M ${w/2} ${h} ` +
              `C ${0} ${h*0.4}, ${0} ${0}, ${w/2} ${h*0.3} ` +
              `C ${w} ${0}, ${w} ${h*0.4}, ${w/2} ${h} Z`;
       break;
    }
    case 'moon': {
        const w = width, h = height;
        path = `M ${w/2} 0 ` +
               `a ${w/2} ${h/2} 0 1 1 0 ${h} ` +
               `a ${w*0.3} ${h*0.5} 0 1 0 0 ${-h} Z`;
        break;
    }
    case 'arrow': {
        const bodyWidth = width * 0.5;
        const bodyHeight = height * 0.4;
        const bodyY = (height - bodyHeight) / 2;
        // Triangle part
        path = `M ${bodyWidth} 0 L ${width} ${height/2} L ${bodyWidth} ${height} `;
        // Rectangle part
        path += `L ${bodyWidth} ${bodyY + bodyHeight} L 0 ${bodyY + bodyHeight} L 0 ${bodyY} L ${bodyWidth} ${bodyY} Z`;
        break;
    }
    case 'cross': {
        const armThickness = Math.min(width, height) / 3;
        const h_arm_y_start = (height - armThickness) / 2;
        const v_arm_x_start = (width - armThickness) / 2;
        
        path = `M ${v_arm_x_start} 0 ` +
               `L ${v_arm_x_start + armThickness} 0 ` +
               `L ${v_arm_x_start + armThickness} ${h_arm_y_start} ` +
               `L ${width} ${h_arm_y_start} ` +
               `L ${width} ${h_arm_y_start + armThickness} ` +
               `L ${v_arm_x_start + armThickness} ${h_arm_y_start + armThickness} ` +
               `L ${v_arm_x_start + armThickness} ${height} ` +
               `L ${v_arm_x_start} ${height} ` +
               `L ${v_arm_x_start} ${h_arm_y_start + armThickness} ` +
               `L 0 ${h_arm_y_start + armThickness} ` +
               `L 0 ${h_arm_y_start} ` +
               `L ${v_arm_x_start} ${h_arm_y_start} ` +
               `Z`;
        break;
    }
    case 'ring': {
        const outerRx = width / 2;
        const outerRy = height / 2;
        const innerRatio = 0.6;
        const innerRx = outerRx * innerRatio;
        const innerRy = outerRy * innerRatio;
        // Outer ellipse (clockwise)
        path = `M ${cx} ${cy-outerRy} a ${outerRx} ${outerRy} 0 1 0 0 ${2*outerRy} a ${outerRx} ${outerRy} 0 1 0 0 ${-2*outerRy} Z`;
        // Inner ellipse (counter-clockwise)
        path += ` M ${cx} ${cy-innerRy} a ${innerRx} ${innerRy} 0 1 1 0 ${2*innerRy} a ${innerRx} ${innerRy} 0 1 1 0 ${-2*innerRy} Z`;
        break;
    }
    default: {
        path = `M ${width/2} 0 L ${width} ${height} L 0 ${height} Z`; // Default Triangle fallback if not listed
        break;
    }
  }
  return path;
};

/**
 * Helper to generate a Bezier path string for an ellipse.
 * This provides a better approximation for boolean operations than arc commands when transformed.
 * @param width - Bounding width of the ellipse.
 * @param height - Bounding height of the ellipse.
 * @returns The SVG path data string using Cubic Béziers.
 */
export const getEllipseAsBeziers = (width: number, height: number): string => {
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const k = 0.5522847498; // Kappa for cubic bezier circle approximation
    const ox = rx * k;
    const oy = ry * k;
    
    const xe = cx + rx;
    const xs = cx - rx;
    const ye = cy + ry;
    const ys = cy - ry;

    // Start at top, clockwise
    return `M ${cx} ${ys} ` + 
           `C ${cx + ox} ${ys} ${xe} ${cy - oy} ${xe} ${cy} ` +
           `C ${xe} ${cy + oy} ${cx + ox} ${ye} ${cx} ${ye} ` +
           `C ${cx - ox} ${ye} ${xs} ${cy + oy} ${xs} ${cy} ` +
           `C ${xs} ${cy - oy} ${cx - ox} ${ys} ${cx} ${ys} Z`;
}

/**
 * Calculates the axis-aligned bounding box of a vector object based on its transformed geometry.
 * @param object - The vector object.
 * @returns The bounding box { x, y, width, height }.
 */
export const getObjectVisualBounds = (object: VectorObject): { x: number, y: number, width: number, height: number } => {
    if (object.type === 'measurement') {
        const mObj = object as MeasurementObject;
        // Measurement objects are defined by absolute coordinates (x1, y1, x2, y2)
        // and do not utilize the rotation/skew transform properties for rendering.
        // Therefore, we return the direct bounds of the defining points.
        const xs = [mObj.x1, mObj.x2];
        const ys = [mObj.y1, mObj.y2];
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.abs(mObj.x2 - mObj.x1),
            height: Math.abs(mObj.y2 - mObj.y1)
        };
    }

    const matrix = getTransformMatrix(object);
    
    const corners: Point[] = [
        [object.x, object.y],
        [object.x + object.width, object.y],
        [object.x + object.width, object.y + object.height],
        [object.x, object.y + object.height]
    ];
    
    const transformedCorners = corners.map(p => transformPoint(p, matrix));
    
    const minX = Math.min(...transformedCorners.map(p => p[0]));
    const minY = Math.min(...transformedCorners.map(p => p[1]));
    const maxX = Math.max(...transformedCorners.map(p => p[0]));
    const maxY = Math.max(...transformedCorners.map(p => p[1]));

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/**
 * Converts any VectorObject into an array of points representing a polygon.
 * For shapes and curves, it approximates them with linear segments.
 * @param obj - The vector object.
 * @param pointCount - Resolution for curves (default: 64).
 * @returns Array of points or null if conversion failed.
 */
export const getObjectAsPolygon = (obj: VectorObject, pointCount: number = 64): Point[] | null => {
    const { x, y, width, height } = obj;
    let localPoints: Point[] | null = null;
    
    if (obj.type === 'polygon') {
        localPoints = obj.points.map(p => p.anchor);
    } else if (obj.type === 'shape') {
        const shapePoints = getShapeAsPolygonPoints(obj.shapeType, obj.width, obj.height, pointCount, obj.cornerRadius);
        if (shapePoints) {
            localPoints = shapePoints.map(p => [p[0] + obj.x, p[1] + obj.y]);
        }
    } else if (obj.type === 'line') {
        localPoints = [[(obj as LineObject).x1, (obj as LineObject).y1], [(obj as LineObject).x2, (obj as LineObject).y2]];
    } else if (obj.type === 'measurement') {
        const mObj = obj as MeasurementObject;
        localPoints = [[mObj.x1, mObj.y1], [mObj.x2, mObj.y2]];
    }

    if (!localPoints) {
        // Fallback for other objects (text, path, generic-path, flow-guide, path-group)
        // Use their bounding box as the polygon.
        localPoints = [ [x, y], [x + width, y], [x + width, y + height], [x, y + height] ];
    }
    
    const matrix = getTransformMatrix(obj);
    
    return localPoints.map(p => transformPoint(p, matrix));
};

/**
 * Creates a mirrored copy of a vector object based on the current mirror mode settings.
 * @param obj - The object to mirror.
 * @param mirrorMode - 'horizontal' or 'vertical'.
 * @param mirrorGap - Gap distance between original and mirrored content.
 * @param canvasWidth - Width of the canvas (for center calculation).
 * @param canvasHeight - Height of the canvas.
 * @returns The mirrored VectorObject.
 */
export const applyMirrorToObject = (
    obj: VectorObject,
    mirrorMode: MirrorMode,
    mirrorGap: number,
    canvasWidth: number,
    canvasHeight: number
): VectorObject => {
    const mirrored: VectorObject = JSON.parse(JSON.stringify(obj));

    if (mirrorMode === 'off') {
        return mirrored;
    }

    const globalAxisX = canvasWidth / 2;
    const globalAxisY = canvasHeight / 2;

    if (mirrorMode === 'horizontal') {
        mirrored.rotation = -obj.rotation;
        if (obj.skewX) mirrored.skewX = -obj.skewX;
        if (obj.skewY) mirrored.skewY = -obj.skewY;
        
        const objCenterX = obj.x + obj.width / 2;
        const objOnLeft = objCenterX <= globalAxisX;
        
        const transformX = (x: number): number => {
            if (objOnLeft) {
                const objRightEdge = obj.x + obj.width;
                return objRightEdge + (objRightEdge - x) + mirrorGap;
            } else {
                const objLeftEdge = obj.x;
                return objLeftEdge - (x - objLeftEdge) - mirrorGap;
            }
        };

        if (mirrored.type === 'polygon' && obj.type === 'polygon') {
            mirrored.points = obj.points.map(p => ({
                anchor:  [transformX(p.anchor[0]), p.anchor[1]] as Point,
                handle1: [transformX(p.handle1[0]), p.handle1[1]] as Point,
                handle2: [transformX(p.handle2[0]), p.handle2[1]] as Point,
            }));
        } else if (mirrored.type === 'path' && obj.type === 'path') {
            mirrored.points = obj.points.map(p => [transformX(p[0]), p[1]]);
        } else if (mirrored.type === 'line' && obj.type === 'line') {
            mirrored.x1 = transformX(obj.x1);
            mirrored.x2 = transformX(obj.x2);
        } else if (mirrored.type === 'measurement' && obj.type === 'measurement') {
            mirrored.x1 = transformX(obj.x1);
            mirrored.x2 = transformX(obj.x2);
        } else { // Bbox objects (Shape, Text, GenericPath)
            const mirrored_x_max = transformX(obj.x);
            const mirrored_x_min = transformX(obj.x + obj.width);
            mirrored.x = mirrored_x_min;
            mirrored.width = mirrored_x_max - mirrored_x_min; // width is always positive
            // Mirror internal content
            mirrored.flipX = !mirrored.flipX;
        }

    } else if (mirrorMode === 'vertical') {
        mirrored.rotation = -obj.rotation;
        if (obj.skewX) mirrored.skewX = -obj.skewX;
        if (obj.skewY) mirrored.skewY = -obj.skewY;
        
        const objCenterY = obj.y + obj.height / 2;
        const objOnTop = objCenterY <= globalAxisY;

        const transformY = (y: number): number => {
            if (objOnTop) {
                const objBottomEdge = obj.y + obj.height;
                return objBottomEdge + (objBottomEdge - y) + mirrorGap;
            } else {
                const objTopEdge = obj.y;
                return objTopEdge - (y - objTopEdge) - mirrorGap;
            }
        };

        if (mirrored.type === 'polygon' && obj.type === 'polygon') {
            mirrored.points = obj.points.map(p => ({
                anchor:  [p.anchor[0], transformY(p.anchor[1])] as Point,
                handle1: [p.handle1[0], transformY(p.handle1[1])] as Point,
                handle2: [p.handle2[0], transformY(p.handle2[1])] as Point,
            }));
        } else if (mirrored.type === 'path' && obj.type === 'path') {
            mirrored.points = obj.points.map(p => [p[0], transformY(p[1])]);
        } else if (mirrored.type === 'line' && obj.type === 'line') {
            mirrored.y1 = transformY(obj.y1);
            mirrored.y2 = transformY(obj.y2);
        } else if (mirrored.type === 'measurement' && obj.type === 'measurement') {
            mirrored.y1 = transformY(obj.y1);
            mirrored.y2 = transformY(obj.y2);
        } else { // Bbox objects
            const mirrored_y_max = transformY(obj.y);
            const mirrored_y_min = transformY(obj.y + obj.height);
            mirrored.y = mirrored_y_min;
            mirrored.height = mirrored_y_max - mirrored_y_min; // height is always positive
            // Mirror internal content
            mirrored.flipY = !mirrored.flipY;
        }
    }

    // Recalculate bounds for point-based objects
    if (mirrored.type === 'polygon') {
        Object.assign(mirrored, calculatePolygonBounds(mirrored.points));
    } else if (mirrored.type === 'path') {
        Object.assign(mirrored, calculatePathBounds(mirrored.points));
    } else if (mirrored.type === 'line') {
        const minX = Math.min(mirrored.x1, mirrored.x2);
        const minY = Math.min(mirrored.y1, mirrored.y2);
        const maxX = Math.max(mirrored.x1, mirrored.x2);
        const maxY = Math.max(mirrored.y1, mirrored.y2);
        mirrored.x = minX; mirrored.y = minY;
        mirrored.width = maxX - minX;
        mirrored.height = maxY - minY;
    } else if (mirrored.type === 'measurement') {
        const minX = Math.min(mirrored.x1, mirrored.x2);
        const minY = Math.min(mirrored.y1, mirrored.y2);
        const maxX = Math.max(mirrored.x1, mirrored.x2);
        const maxY = Math.max(mirrored.y1, mirrored.y2);
        mirrored.x = minX; mirrored.y = minY;
        mirrored.width = maxX - minX;
        mirrored.height = maxY - minY;
    }
    return mirrored;
};

/**
 * Transforms a point from the layer's local coordinate system to the world coordinate system.
 * @param localPoint - The point in layer space.
 * @param layer - The layer object (containing offset, rotation, etc.).
 * @param canvasSize - The dimensions of the canvas.
 * @returns The point in world space.
 */
export const transformLayerLocalPointToWorld = (localPoint: Point, layer: Layer, canvasSize: {width: number, height: number}): Point => {
    const pivot: Point = [canvasSize.width / 2, canvasSize.height / 2];
    const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = layer;
    
    const matrix = new DOMMatrix();
    matrix.translateSelf(pivot[0] + offsetX, pivot[1] + offsetY);
    matrix.rotateSelf(rotation);
    matrix.skewXSelf(skewX);
    matrix.skewYSelf(skewY);
    matrix.scaleSelf(layerScale, layerScale);
    matrix.translateSelf(-pivot[0], -pivot[1]);
    
    return transformPoint(localPoint, matrix);
};

/**
 * Transforms a point from the world coordinate system to the layer's local coordinate system.
 * @param worldPoint - The point in world space.
 * @param layer - The layer object.
 * @param canvasSize - The dimensions of the canvas.
 * @returns The point in layer space.
 */
export const transformWorldPointToLayerLocal = (worldPoint: Point, layer: Layer, canvasSize: {width: number, height: number}): Point => {
    const pivot: Point = [canvasSize.width / 2, canvasSize.height / 2];
    const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = layer;

    const matrix = new DOMMatrix();
    matrix.translateSelf(pivot[0] + offsetX, pivot[1] + offsetY);
    matrix.rotateSelf(rotation);
    matrix.skewXSelf(skewX);
    matrix.skewYSelf(skewY);
    matrix.scaleSelf(layerScale, layerScale);
    matrix.translateSelf(-pivot[0], -pivot[1]);
    
    const inverseMatrix = matrix.inverse();
    return transformPoint(worldPoint, inverseMatrix);
};

let cachedPathMeasureElement: SVGPathElement | null = null;
function getPathMeasureElement(): SVGPathElement | null {
    if (cachedPathMeasureElement) return cachedPathMeasureElement;
    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
        cachedPathMeasureElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        return cachedPathMeasureElement;
    }
    return null;
}

/**
 * Extracts the SVG 'd' attribute string representing the geometry of any VectorObject.
 * Applies object transforms directly to the path data where possible.
 * @param object - The vector object.
 * @returns The path data string, or null if not applicable.
 */
export function getSVGPathFromObject(object: VectorObject): string | null {
    let d: string | null = null;
    
    // We need to apply the transform to the points directly if we want the path geometry to reflect it
    // without relying on the 'transform' attribute.
    const matrix = getTransformMatrix(object);

    switch (object.type) {
        case 'generic-path': {
            const genericPathObj = object as GenericPathObject;
            const originalBounds = calculateGenericPathBounds(genericPathObj.d);
            const scaleX = originalBounds.width > 0 ? genericPathObj.width / originalBounds.width : 1;
            const scaleY = originalBounds.height > 0 ? genericPathObj.height / originalBounds.height : 1;
            const dx = genericPathObj.x - originalBounds.x * scaleX;
            const dy = genericPathObj.y - originalBounds.y * scaleY;

            const rotCenterX = genericPathObj.x + genericPathObj.width / 2;
            const rotCenterY = genericPathObj.y + genericPathObj.height / 2;

            // Replicate SVG transform order: rotate/skew around center, then translate, then scale.
            // DOMMatrix methods apply in order of calls (last call applies first to point).
            const matrix = new DOMMatrix();
            
            // 3. Rotate/Skew/Flip around center
            matrix.translateSelf(rotCenterX, rotCenterY);
            matrix.rotateSelf(genericPathObj.rotation);
            if (genericPathObj.skewX) matrix.skewXSelf(genericPathObj.skewX);
            if (genericPathObj.skewY) matrix.skewYSelf(genericPathObj.skewY);
            if (genericPathObj.flipX) matrix.scaleSelf(-1, 1);
            if (genericPathObj.flipY) matrix.scaleSelf(1, -1);
            matrix.translateSelf(-rotCenterX, -rotCenterY);

            // 2. Translate
            matrix.translateSelf(dx, dy);

            // 1. Scale
            matrix.scaleSelf(scaleX, scaleY);

            return _transformPathData(genericPathObj.d, matrix);
        }

        case 'polygon': {
            const rotatedVertices = object.points.map(vertex => ({
                anchor: transformPoint(vertex.anchor, matrix),
                handle1: transformPoint(vertex.handle1, matrix),
                handle2: transformPoint(vertex.handle2, matrix),
            }));
            d = getPolygonPathWithCurves(rotatedVertices, object.isClosed);
            break;
        }
            
        case 'path': {
            const rotatedPoints = object.points.map(p => transformPoint(p, matrix));
            d = getSmoothedPolylinePath(rotatedPoints, object.smoothing);
            break;
        }

        case 'shape': {
            if (object.shapeType === 'ellipse' || object.shapeType === 'ring') {
                // Use Bezier construction for ellipses/circles to ensure smoother boolean ops and transformations
                // instead of using Arcs which transformPathData approximates poorly.
                
                // Ellipse Logic
                let path = getEllipseAsBeziers(object.width, object.height);
                
                if (object.shapeType === 'ring') {
                    // For ring, add inner ellipse (counter-clockwise)
                    const outerW = object.width;
                    const outerH = object.height;
                    const innerW = outerW * 0.6;
                    const innerH = outerH * 0.6;
                    
                    // Counter-clockwise
                    const innerPath = getEllipseAsBeziers(innerW, innerH);
                    // Reverse logic not fully implemented here for brevity, using standard getEllipseAsBeziers
                    // Correct ring implementation for boolean ops requires proper winding
                    
                    // Just construct it manually reversed and translated
                    const cx = object.width / 2;
                    const cy = object.height / 2;
                    const rx = innerW / 2;
                    const ry = innerH / 2;
                    const k = 0.5522847498;
                    const ox = rx * k;
                    const oy = ry * k;
                    
                    const xe = cx + rx;
                    const xs = cx - rx;
                    const ye = cy + ry;
                    const ys = cy - ry;
                    
                    const innerD = `M ${cx} ${ys} ` +
                                   `C ${cx - ox} ${ys} ${xs} ${cy - oy} ${xs} ${cy} ` +
                                   `C ${xs} ${cy + oy} ${cx - ox} ${ye} ${cx} ${ye} ` +
                                   `C ${cx + ox} ${ye} ${xe} ${cy + oy} ${xe} ${cy} ` +
                                   `C ${xe} ${cy - oy} ${cx + ox} ${ys} ${cx} ${ys} Z`;
                                   
                    path += " " + innerD;
                }
                
                // Apply transform to the bezier path
                const shapeMatrix = new DOMMatrix();
                const cx = object.x + object.width / 2;
                const cy = object.y + object.height / 2;
                
                shapeMatrix.translateSelf(cx, cy);
                shapeMatrix.rotateSelf(object.rotation);
                if (object.skewX) shapeMatrix.skewXSelf(object.skewX);
                if (object.skewY) shapeMatrix.skewYSelf(object.skewY);
                if (object.flipX) shapeMatrix.scaleSelf(-1, 1);
                if (object.flipY) shapeMatrix.scaleSelf(1, -1);
                shapeMatrix.translateSelf(-object.width / 2, -object.height / 2);
                
                d = _transformPathData(path, shapeMatrix);

            } else {
                // For polygons (rect, star, etc), use the linear approximation logic
                const shapePoints = getShapeAsPolygonPoints(object.shapeType, object.width, object.height, 64, object.cornerRadius);
                if (!shapePoints) return null;
                
                const translatedPoints = shapePoints.map(p => [p[0] + object.x, p[1] + object.y] as Point);
                const rotatedPoints = translatedPoints.map(p => transformPoint(p, matrix));
    
                d = `M ${rotatedPoints[0].join(',')} ` + rotatedPoints.slice(1).map(p => `L ${p.join(',')}`).join(' ') + ' Z';
            }
            break;
        }
            
        case 'line': {
            const p1 = transformPoint([object.x1, object.y1], matrix);
            const p2 = transformPoint([object.x2, object.y2], matrix);
            d = `M ${p1.join(',')} L ${p2.join(',')}`;
            break;
        }
        
        case 'measurement': {
            const m = object as MeasurementObject;
            const p1 = transformPoint([m.x1, m.y1], matrix);
            const p2 = transformPoint([m.x2, m.y2], matrix);
            d = `M ${p1.join(',')} L ${p2.join(',')}`;
            break;
        }

        default: {
            // For types like 'text', 'flow-guide', 'path-group', we can use their bounding box as a path.
            const points = getObjectAsPolygon(object);
            if (!points) return null;
            d = `M ${points[0].join(',')} ` + points.slice(1).map(p => `L ${p.join(',')}`).join(' ') + ' Z';
            break;
        }
    }
    
    return d;
}

/**
 * Calculates the total length of an SVG path.
 * Uses an off-screen SVG element for computation.
 * @param d - The SVG path data string.
 * @returns The length in pixels.
 */
export function getPathTotalLength(d: string): number {
    if (!d) return 0;
    const el = getPathMeasureElement();
    if (!el) {
        // Fallback length estimation for lines/simple segments if non-DOM
        const match = d.match(/M\s*([\d.-]+)[\s,]+([\d.-]+)\s*L\s*([\d.-]+)[\s,]+([\d.-]+)/i);
        if (match) {
            const [, x1, y1, x2, y2] = match.map(Number);
            return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        }
        return 0;
    }
    el.setAttribute('d', d);
    return el.getTotalLength();
}

/**
 * Returns the point coordinate and tangent angle at a specific length along a path.
 * @param d - The SVG path data string.
 * @param length - The distance along the path.
 * @returns An object containing the point [x, y] and angle in degrees.
 */
export function getPointAndTangentAtLength(d: string, length: number): { point: Point, angle: number } | null {
    const el = getPathMeasureElement();
    if (!el) {
        // Fallback for simple line paths
        const match = d.match(/M\s*([\d.-]+)[\s,]+([\d.-]+)\s*L\s*([\d.-]+)[\s,]+([\d.-]+)/i);
        if (match) {
            const [, x1, y1, x2, y2] = match.map(Number);
            const totalLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            if (totalLen === 0) return null;
            const t = Math.max(0, Math.min(length / totalLen, 1));
            const point: Point = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            return { point, angle };
        }
        return null;
    }

    el.setAttribute('d', d);
    const totalLength = el.getTotalLength();
    if (totalLength === 0) return null;

    const clampedLength = Math.max(0, Math.min(length, totalLength));
    
    const point = el.getPointAtLength(clampedLength);

    // Approximate tangent by taking two close points
    const p1 = el.getPointAtLength(Math.max(0, clampedLength - 0.1));
    const p2 = el.getPointAtLength(Math.min(totalLength, clampedLength + 0.1));
    
    // Check for stationary point
    if (p1.x === p2.x && p1.y === p2.y && clampedLength > 0.1) {
        const p0 = el.getPointAtLength(clampedLength - 0.2);
        const angle = Math.atan2(point.y - p0.y, point.x - p0.x) * 180 / Math.PI;
        return { point: [point.x, point.y], angle };
    }

    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

    return { point: [point.x, point.y], angle };
}

/**
 * Flattens a Cubic Bézier curve into discrete line segments.
 * @param p1 - Start point.
 * @param cp1 - Control point 1.
 * @param cp2 - Control point 2.
 * @param p2 - End point.
 * @param steps - Number of segments (default: 16).
 * @returns Array of points along the curve.
 */
export const flattenBezier = (p1: Point, cp1: Point, cp2: Point, p2: Point, steps = 16): Point[] => {
    const points: Point[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const x = p1[0] * mt3 + cp1[0] * 3 * mt2 * t + cp2[0] * 3 * mt * t2 + p2[0] * t3;
        const y = p1[1] * mt3 + cp1[1] * 3 * mt2 * t + cp2[1] * 3 * mt * t2 + p2[1] * t3;
        points.push([x, y]);
    }
    return points;
};

/**
 * Clips a line segment defined by p1 and p2 using a polygon.
 * Returns segments of the line that lie inside the polygon.
 * @param p1 - Start point of the line.
 * @param p2 - End point of the line.
 * @param polygon - Array of points defining the polygon.
 * @returns An array of line segments [start, end].
 */
export function clipLineSegmentByPolygon(p1: Point, p2: Point, polygon: Point[]): [Point, Point][] {
    // Helper to find intersection of two line segments
    function lineIntersection(l1_p1: Point, l1_p2: Point, l2_p1: Point, l2_p2: Point): Point | null {
        const den = (l1_p1[0] - l1_p2[0]) * (l2_p1[1] - l2_p2[1]) - (l1_p1[1] - l1_p2[1]) * (l2_p1[0] - l2_p2[0]);
        if (den === 0) return null; // Parallel or collinear

        const t = ((l1_p1[0] - l2_p1[0]) * (l2_p1[1] - l2_p2[1]) - (l1_p1[1] - l2_p1[1]) * (l1_p1[0] - l2_p1[0])) / den;
        const u = -((l1_p1[0] - l1_p2[0]) * (l1_p1[1] - l2_p1[1]) - (l1_p1[1] - l2_p1[1]) * (l1_p1[0] - l2_p1[0])) / den;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return [l1_p1[0] + t * (l1_p2[0] - l1_p1[0]), l1_p1[1] + t * (l1_p2[1] - l1_p1[1])];
        }
        return null;
    }

    const interestPoints: Point[] = [p1, p2];

    // Find all intersections with polygon edges
    for (let i = 0; i < polygon.length; i++) {
        const poly_p1 = polygon[i];
        const poly_p2 = polygon[(i + 1) % polygon.length];
        
        const intersection = lineIntersection(p1, p2, poly_p1, poly_p2);
        if (intersection) {
            interestPoints.push(intersection);
        }
    }
    
    // Sort points along the line segment's direction
    const distSqFromP1 = (pt: Point) => (pt[0] - p1[0])**2 + (pt[1] - p1[1])**2;
    interestPoints.sort((a, b) => distSqFromP1(a) - distSqFromP1(b));
    
    // Remove duplicate points
    const uniquePoints: Point[] = [];
    if (interestPoints.length > 0) {
        uniquePoints.push(interestPoints[0]);
        for (let i = 1; i < interestPoints.length; i++) {
            if (distSq(interestPoints[i], interestPoints[i-1]) > 1e-9) {
                uniquePoints.push(interestPoints[i]);
            }
        }
    }

    if (uniquePoints.length < 2) return [];

    // Check midpoint of each new sub-segment to see if it's inside the polygon
    const clippedSegments: [Point, Point][] = [];
    for (let i = 0; i < uniquePoints.length - 1; i++) {
        const start = uniquePoints[i];
        const end = uniquePoints[i+1];
        const midPoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];

        // Assuming d3 is globally available
        if ((window as any).d3.polygonContains(polygon, midPoint)) {
            clippedSegments.push([start, end]);
        }
    }
    
    return clippedSegments;
}

/**
 * Clips a subject polygon against a clip polygon using the Sutherland-Hodgman algorithm.
 * @param subjectPolygon - Vertices of the polygon to be clipped.
 * @param clipPolygon - Vertices of the clipping polygon.
 * @returns The resulting clipped polygon vertices.
 */
export function sutherlandHodgmanClip(subjectPolygon: Point[], clipPolygon: Point[]): Point[] {
    let currentPoints = subjectPolygon;

    const clipEdge = (subject: Point[], p1: Point, p2: Point): Point[] => {
        const newPoints: Point[] = [];
        
        const isInside = (p: Point): boolean => {
            return (p2[0] - p1[0]) * (p[1] - p1[1]) - (p2[1] - p1[1]) * (p[0] - p1[0]) >= 0;
        };
        
        const intersection = (s1: Point, s2: Point): Point => {
            const dc: Point = [p1[0] - p2[0], p1[1] - p2[1]];
            const dp: Point = [s1[0] - s2[0], s1[1] - s2[1]];
            const n1 = p1[0] * p2[1] - p1[1] * p2[0];
            const n2 = s1[0] * s2[1] - s1[1] * s2[0];
            const den = dc[0] * dp[1] - dc[1] * dp[0];
            if (Math.abs(den) < 1e-9) return s2;
            const x = (n1 * dp[0] - n2 * dc[0]) / den;
            const y = (n1 * dp[1] - n2 * dc[1]) / den;
            return [x, y];
        };

        if (subject.length === 0) return [];
        
        let prevPoint = subject[subject.length - 1];
        let isPrevInside = isInside(prevPoint);

        for (let i = 0; i < subject.length; i++) {
            const currentPoint = subject[i];
            const isCurrentInside = isInside(currentPoint);

            if (isCurrentInside) {
                if (!isPrevInside) {
                    newPoints.push(intersection(prevPoint, currentPoint));
                }
                newPoints.push(currentPoint);
            } else if (isPrevInside) {
                newPoints.push(intersection(prevPoint, currentPoint));
            }
            
            prevPoint = currentPoint;
            isPrevInside = isCurrentInside;
        }
        
        return newPoints;
    };
    
    // Ensure clip polygon is CCW for isInside check to work correctly
    let signedArea = 0;
    for (let i = 0; i < clipPolygon.length; i++) {
        const p1 = clipPolygon[i];
        const p2 = clipPolygon[(i + 1) % clipPolygon.length];
        signedArea += (p1[0] * p2[1] - p2[0] * p1[1]);
    }
    const orientedClipPolygon = signedArea > 0 ? clipPolygon : [...clipPolygon].reverse();

    for (let i = 0; i < orientedClipPolygon.length; i++) {
        const p1 = orientedClipPolygon[i];
        const p2 = orientedClipPolygon[(i + 1) % orientedClipPolygon.length];
        currentPoints = clipEdge(currentPoints, p1, p2);
        if (currentPoints.length === 0) break;
    }
    
    return currentPoints;
}

/**
 * Prunes duplicate consecutive points within a given numerical distance epsilon.
 * 
 * @param points - Array of 2D points.
 * @param epsilon - Distance threshold below which points are considered identical (default: 1e-4).
 * @returns Cleaned array of unique consecutive points.
 */
export function pruneDuplicateVertices(points: Point[], epsilon: number = 1e-4): Point[] {
    if (points.length <= 1) return [...points];
    const cleaned: Point[] = [points[0]];
    const epsSq = epsilon * epsilon;

    for (let i = 1; i < points.length; i++) {
        const prev = cleaned[cleaned.length - 1];
        const curr = points[i];
        const dx = curr[0] - prev[0];
        const dy = curr[1] - prev[1];
        if (dx * dx + dy * dy > epsSq) {
            cleaned.push(curr);
        }
    }

    // Check last vs first if closed loop with > 2 points
    if (cleaned.length > 2) {
        const first = cleaned[0];
        const last = cleaned[cleaned.length - 1];
        const dx = last[0] - first[0];
        const dy = last[1] - first[1];
        if (dx * dx + dy * dy <= epsSq) {
            cleaned.pop();
        }
    }

    return cleaned;
}

/**
 * Removes redundant collinear points from a polygon or polyline.
 * 
 * @param points - Array of points.
 * @param epsilon - Cross-product tolerance threshold for collinearity (default: 1e-4).
 * @returns Array with redundant intermediate vertices removed.
 */
export function pruneColinearVertices(points: Point[], epsilon: number = 1e-4): Point[] {
    if (points.length < 3) return [...points];
    const cleaned: Point[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
        const prev = cleaned[cleaned.length - 1];
        const curr = points[i];
        const next = points[i + 1];

        const v1x = curr[0] - prev[0];
        const v1y = curr[1] - prev[1];
        const v2x = next[0] - curr[0];
        const v2y = next[1] - curr[1];

        const cross = Math.abs(v1x * v2y - v1y * v2x);
        const l1 = Math.hypot(v1x, v1y);
        const l2 = Math.hypot(v2x, v2y);

        if (l1 === 0 || l2 === 0 || cross / (l1 * l2) > epsilon) {
            cleaned.push(curr);
        }
    }

    cleaned.push(points[points.length - 1]);
    return cleaned;
}

/**
 * Enforces polygon vertex winding order (Clockwise for outer perimeters, Counter-Clockwise for holes).
 * 
 * @param points - Polygon vertex loop.
 * @param clockwise - True for clockwise, false for counter-clockwise.
 * @returns Polygon points with guaranteed winding.
 */
export function normalizePolygonWinding(points: Point[], clockwise: boolean = true): Point[] {
    if (points.length < 3) return [...points];
    let signedArea = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        signedArea += (p1[0] * p2[1] - p2[0] * p1[1]);
    }
    const isCurrentlyCW = signedArea < 0;
    if (isCurrentlyCW !== clockwise) {
        return [...points].reverse();
    }
    return [...points];
}

/**
 * Computes an outward (or inward) kerf compensation offset for CNC or laser cutter paths.
 * 
 * @param points - Polygon points.
 * @param kerfOffset - Offset distance (positive for outward expansion, negative for inward).
 * @param isClosed - Whether the path is a closed polygon.
 * @returns Offset polygon points.
 */
export function calculateKerfOffset(points: Point[], kerfOffset: number, isClosed: boolean = true): Point[] {
    if (points.length < 2 || kerfOffset === 0) return [...points];
    const n = points.length;
    const offsetPoints: Point[] = [];

    // Calculate edge normals
    const normals: Point[] = [];
    for (let i = 0; i < (isClosed ? n : n - 1); i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.hypot(dx, dy);
        if (len === 0) {
            normals.push([0, 0]);
        } else {
            // Normal pointing right of direction vector (outward for CCW / inward for CW)
            normals.push([dy / len, -dx / len]);
        }
    }

    if (!isClosed) {
        // Open polyline offset
        offsetPoints.push([
            points[0][0] + normals[0][0] * kerfOffset,
            points[0][1] + normals[0][1] * kerfOffset
        ]);

        for (let i = 1; i < n - 1; i++) {
            const n1 = normals[i - 1];
            const n2 = normals[i];
            const avgNx = (n1[0] + n2[0]) / 2;
            const avgNy = (n1[1] + n2[1]) / 2;
            const avgLen = Math.hypot(avgNx, avgNy);
            if (avgLen > 1e-4) {
                const scale = kerfOffset / avgLen;
                offsetPoints.push([points[i][0] + avgNx * scale, points[i][1] + avgNy * scale]);
            } else {
                offsetPoints.push([points[i][0] + n1[0] * kerfOffset, points[i][1] + n1[1] * kerfOffset]);
            }
        }

        const lastN = normals[normals.length - 1];
        offsetPoints.push([
            points[n - 1][0] + lastN[0] * kerfOffset,
            points[n - 1][1] + lastN[1] * kerfOffset
        ]);
        return offsetPoints;
    }

    // Closed polygon vertex offsets
    for (let i = 0; i < n; i++) {
        const prevIdx = (i - 1 + n) % n;
        const n1 = normals[prevIdx];
        const n2 = normals[i];
        const avgNx = (n1[0] + n2[0]) / 2;
        const avgNy = (n1[1] + n2[1]) / 2;
        const avgLen = Math.hypot(avgNx, avgNy);
        if (avgLen > 1e-4) {
            const scale = kerfOffset / avgLen;
            offsetPoints.push([points[i][0] + avgNx * scale, points[i][1] + avgNy * scale]);
        } else {
            offsetPoints.push([points[i][0] + n2[0] * kerfOffset, points[i][1] + n2[1] * kerfOffset]);
        }
    }

    return offsetPoints;
}
