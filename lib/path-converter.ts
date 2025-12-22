
import paper from 'paper';
import type { VectorObject, PolygonObject, PolygonVertex, ShapeObject, LineObject, GenericPathObject, PathObject, Point } from '../types';
import { getShapePath, getTransformMatrix, getEllipseAsBeziers, getSmoothedPolylinePath, calculateGenericPathBounds } from './geometry';

/**
 * Initializes Paper.js with a dummy canvas if it hasn't been initialized yet.
 * Paper.js needs a scope to perform vector mathematics.
 */
const initPaper = () => {
    if (!paper.project) {
        const canvas = document.createElement('canvas');
        paper.setup(canvas);
    }
};

/**
 * Pre-simplifies a path by removing points that are nearly collinear.
 * @param points - The input points of the path.
 * @param angleToleranceDeg - The angle threshold in degrees. Points forming an angle less than this will be removed.
 * @returns A new array of simplified points.
 */
function simplifyCollinearPoints(points: Point[], angleToleranceDeg: number): Point[] {
    if (points.length < 3) return points;

    const angleToleranceRad = angleToleranceDeg * (Math.PI / 180);
    const result: Point[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
        const p_prev = result[result.length - 1]; // Previous kept point
        const p_curr = points[i];
        const p_next = points[i + 1];

        const v1: Point = [p_curr[0] - p_prev[0], p_curr[1] - p_prev[1]];
        const v2: Point = [p_next[0] - p_curr[0], p_next[1] - p_curr[1]];

        const len1 = Math.sqrt(v1[0]**2 + v1[1]**2);
        const len2 = Math.sqrt(v2[0]**2 + v2[1]**2);

        if (len1 < 1e-6 || len2 < 1e-6) {
            // one of the points is a duplicate, skip current point p_curr
            continue;
        }

        const v1_norm: Point = [v1[0] / len1, v1[1] / len1];
        const v2_norm: Point = [v2[0] / len2, v2[1] / len2];

        const dot = v1_norm[0] * v2_norm[0] + v1_norm[1] * v2_norm[1];
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))); // Angle between vectors

        // If the angle between segments is greater than our tolerance, it's a corner we should keep.
        if (angle >= angleToleranceRad) {
            result.push(p_curr);
        }
    }
    
    result.push(points[points.length - 1]);
    return result;
}


/**
 * Converts a given VectorObject (like Shape, Line, or GenericPath) into an array of PolygonObjects.
 * This process "bakes" the geometry into editable vertices, applying all transformations.
 * Uses Paper.js to robustly parse and flatten SVG path data.
 * If the source object is a Compound Path (multiple disjoint sub-paths), it returns multiple PolygonObjects.
 * 
 * @param object - The source object to convert.
 * @returns An array of new PolygonObjects containing the geometry of the source, or null if conversion is not possible.
 */
export function convertObjectToPolygon(object: VectorObject): PolygonObject[] | null {
    initPaper();
    
    let d: string | null = null;
    let matrix = new DOMMatrix();

    // 1. Extract Path Data and Transformation Matrix based on object type
    switch (object.type) {
        case 'shape': {
            const shape = object as ShapeObject;
            // For ellipse, use bezier approximation to ensure smooth editing handles
            if (shape.shapeType === 'ellipse') {
                d = getEllipseAsBeziers(shape.width, shape.height);
            } else {
                d = getShapePath(shape.shapeType, shape.width, shape.height, shape.cornerRadius);
            }
            
            // Build transform matrix to map local shape definition to world space
            const cx = shape.width / 2;
            const cy = shape.height / 2;
            matrix.translateSelf(shape.x, shape.y);
            matrix.translateSelf(cx, cy);
            matrix.rotateSelf(shape.rotation);
            if(shape.skewX) matrix.skewXSelf(shape.skewX);
            if(shape.skewY) matrix.skewYSelf(shape.skewY);
            matrix.translateSelf(-cx, -cy);
            break;
        }
        case 'line': {
            // Lines are simple enough to handle manually without Paper.js overhead
            const line = object as LineObject;
            const p1 = [line.x1, line.y1] as [number, number];
            const p2 = [line.x2, line.y2] as [number, number];
            return [{
                id: String(Date.now() + Math.random()),
                type: 'polygon',
                points: [
                    { anchor: p1, handle1: p1, handle2: p1 },
                    { anchor: p2, handle1: p2, handle2: p2 },
                ],
                isClosed: false,
                x: Math.min(line.x1, line.x2),
                y: Math.min(line.y1, line.y2),
                width: Math.abs(line.x2 - line.x1),
                height: Math.abs(line.y2 - line.y1),
                rotation: 0, skewX: 0, skewY: 0,
                fill: object.fill, stroke: object.stroke, strokeWidth: object.strokeWidth,
                opacity: object.opacity, fillOpacity: object.fillOpacity, strokeOpacity: object.strokeOpacity, blendMode: object.blendMode,
                strokeLinecap: object.strokeLinecap, strokeLinejoin: object.strokeLinejoin, strokeDasharray: object.strokeDasharray, strokeDashoffset: object.strokeDashoffset
            }];
        }
        case 'generic-path': {
            const path = object as GenericPathObject;
            d = path.d;
            
            // Calculate proper transform including scale and translation from original path bounds
            const originalBounds = calculateGenericPathBounds(path.d);
            const scaleX = originalBounds.width > 0 ? path.width / originalBounds.width : 1;
            const scaleY = originalBounds.height > 0 ? path.height / originalBounds.height : 1;
            const dx = path.x - originalBounds.x * scaleX;
            const dy = path.y - originalBounds.y * scaleY;

            const rotCenterX = path.x + path.width / 2;
            const rotCenterY = path.y + path.height / 2;

            // Construct matrix: Center-Transform -> Translate -> Scale
            matrix = new DOMMatrix();
            
            // 3. Rotate/Skew/Flip around center
            matrix.translateSelf(rotCenterX, rotCenterY);
            matrix.rotateSelf(path.rotation);
            if (path.skewX) matrix.skewXSelf(path.skewX);
            if (path.skewY) matrix.skewYSelf(path.skewY);
            if (path.flipX) matrix.scaleSelf(-1, 1);
            if (path.flipY) matrix.scaleSelf(1, -1);
            matrix.translateSelf(-rotCenterX, -rotCenterY);

            // 2. Translate to object position
            matrix.translateSelf(dx, dy);

            // 1. Scale from original path size
            matrix.scaleSelf(scaleX, scaleY);
            break;
        }
        case 'path': {
            initPaper(); // ensure paper is initialized
            const pathObject = object as PathObject;

            // New pre-simplification step based on angle tolerance to remove redundant collinear points
            const angleToleranceDeg = 5 + (pathObject.smoothing * 15); // e.g., 5 to 20 degrees
            const preSimplifiedPoints = simplifyCollinearPoints(pathObject.points, angleToleranceDeg);
            
            const paperPath = new paper.Path(preSimplifiedPoints.map(p => new paper.Point(p[0], p[1])));
            
            // Map smoothing (0-1) to a tolerance range
            const tolerance = 0.5 + pathObject.smoothing * 9.5;
            paperPath.simplify(tolerance);

            // Now apply the object's transformation matrix
            const transformMatrix = getTransformMatrix(pathObject);
            const paperMatrix = new paper.Matrix(transformMatrix.a, transformMatrix.c, transformMatrix.b, transformMatrix.d, transformMatrix.e, transformMatrix.f);
            paperPath.transform(paperMatrix);

            const newPoints: PolygonVertex[] = paperPath.segments.map(s => ({
                anchor: [s.point.x, s.point.y],
                handle1: [s.point.x + s.handleIn.x, s.point.y + s.handleIn.y],
                handle2: [s.point.x + s.handleOut.x, s.point.y + s.handleOut.y]
            }));

            const b = paperPath.bounds;
            paperPath.remove();

            return [{
                id: String(Date.now() + Math.random()),
                type: 'polygon',
                points: newPoints,
                isClosed: false, // freehand paths are open
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                rotation: 0, // Rotation is baked into points
                skewX: 0,
                skewY: 0,
                fill: object.fill,
                stroke: object.stroke,
                strokeWidth: object.strokeWidth,
                strokeLinecap: object.strokeLinecap,
                strokeLinejoin: object.strokeLinejoin,
                strokeDasharray: object.strokeDasharray,
                strokeDashoffset: object.strokeDashoffset,
                opacity: object.opacity,
                fillOpacity: object.fillOpacity,
                strokeOpacity: object.strokeOpacity,
                blendMode: object.blendMode
            }];
        }
        default:
            return null;
    }

    if (!d) return null;

    try {
        // 2. Use Paper.js to parse the SVG path data
        // CompoundPath handles multiple sub-paths and complex commands (A, Q, S, T) automatically.
        const tempPath = new paper.CompoundPath(d);
        
        // 3. Apply the object's transform matrix to the Paper.js path
        // DOMMatrix (a, b, c, d, e, f) maps to Paper Matrix(a, c, b, d, tx, ty)
        const paperMatrix = new paper.Matrix(matrix.a, matrix.c, matrix.b, matrix.d, matrix.e, matrix.f);
        tempPath.matrix = paperMatrix;
        
        const polygons: PolygonObject[] = [];

        // Helper to convert a Paper Path Item to a PolygonObject
        const extractPolygon = (pathItem: paper.Path) => {
            // Bake the transform into the child segments
            const flatChild = pathItem.clone();
            // Use the parent's matrix if it was a child of a compound path which had the matrix applied
            // Note: tempPath.matrix applies to children visually, but flatChild.transform bakes it.
            // If we are iterating tempPath.children, they inherit transform.
            // However, PaperJS transform() on items accumulates.
            // We applied transform to tempPath.
            // To bake it into children, we need to ensure we transform them with the full matrix.
            // Since we applied it to tempPath, children are transformed.
            // But flattening requires explicit transform call if we detach them?
            // Actually, if we clone a transformed path, the clone has the transform.
            
            // To flatten (apply transform to segments and reset matrix), we don't strictly need to do anything special
            // if we just read segments.point (which are local) vs transformed?
            // No, PaperJS segments are local. We must flatten.
            // We can use pathItem.transform(matrix) but we already did that to parent.
            // Actually, applying matrix to CompoundPath applies it to children.
            // So flatChild already has the matrix set. We just need to apply it to segments.
            // There isn't a direct "flatten" method in PaperJS v0.12 that clears matrix, 
            // but reading global coordinates or simply not resetting matrix?
            // The PolygonObject expects [x,y] points in world space (relative to its own x,y which is bbox top-left).
            // But we set PolygonObject rotation to 0. So points should be "world" (layer local).
            
            // Re-apply matrix logic:
            // Since we applied matrix to tempPath, let's just make sure we get the points correctly.
            // We'll create a new Path, add segments transformed.
            
            // Better approach:
            // 1. Create flat clone.
            // 2. Clear its matrix but apply it to segments?
            // PaperJS doesn't have a simple 'bake' command.
            // But we can do: `flatChild.transform(new paper.Matrix())` ? No.
            
            // We already applied `tempPath.matrix = paperMatrix`.
            // Let's just clone the child. It inherits the transform if it was inside? No, clones are detached.
            // We need to manually apply the transform to the clone.
            
            flatChild.transform(tempPath.matrix);
            
            const newPoints: PolygonVertex[] = flatChild.segments.map(s => ({
                anchor: [s.point.x, s.point.y],
                handle1: [s.point.x + s.handleIn.x, s.point.y + s.handleIn.y],
                handle2: [s.point.x + s.handleOut.x, s.point.y + s.handleOut.y]
            }));
            
            const isClosed = flatChild.closed;
            const b = flatChild.bounds;
            
            polygons.push({
                id: String(Date.now() + Math.random()),
                type: 'polygon',
                points: newPoints,
                isClosed,
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                rotation: 0, // Rotation is baked into points
                skewX: 0,
                skewY: 0,
                fill: object.fill,
                stroke: object.stroke,
                strokeWidth: object.strokeWidth,
                strokeLinecap: object.strokeLinecap,
                strokeLinejoin: object.strokeLinejoin,
                strokeDasharray: object.strokeDasharray,
                strokeDashoffset: object.strokeDashoffset,
                opacity: object.opacity,
                fillOpacity: object.fillOpacity,
                strokeOpacity: object.strokeOpacity,
                blendMode: object.blendMode
            });
            
            flatChild.remove();
        };

        // 4. Iterate over all sub-paths
        if (tempPath.children) {
            tempPath.children.forEach(c => {
                if (c instanceof paper.Path) {
                    // Only process path if it has area or length (ignore zero-length artifacts)
                    if (Math.abs(c.area) > 0.001 || c.length > 0.001) {
                        extractPolygon(c);
                    }
                }
            });
        } else if (tempPath instanceof paper.Path) {
             // It might be a simple Path if SVG was simple
             extractPolygon(tempPath);
        } else {
             // Fallback if CompoundPath has no children (shouldn't happen with valid d)
             // Maybe it acted as a Path?
             // PaperJS CompoundPath is usually a container.
        }
        
        // Cleanup Paper.js items
        tempPath.remove();
        
        return polygons.length > 0 ? polygons : null;

    } catch (e) {
        console.error("Path conversion failed", e);
        return null;
    }
}

/**
 * Simplifies a series of points into an optimized set of Bezier segments (PolygonVertex).
 * Uses Paper.js simplification algorithm.
 * 
 * @param points - The raw input points (e.g. from freehand drawing).
 * @param tolerance - The simplification tolerance (default 2.5). Higher values = fewer points, smoother curve.
 * @returns Array of PolygonVertex representing the smoothed path.
 */
export function simplifyPointsToPolygonVertices(points: Point[], tolerance: number = 2.5): PolygonVertex[] {
    initPaper();
    if (points.length < 2) return [];

    // Create path from raw points
    const path = new paper.Path(points.map(p => new paper.Point(p[0], p[1])));
    
    // Simplify processing
    path.simplify(tolerance);

    // Extract segments
    const vertices: PolygonVertex[] = path.segments.map(s => ({
        anchor: [s.point.x, s.point.y],
        handle1: [s.point.x + s.handleIn.x, s.point.y + s.handleIn.y],
        handle2: [s.point.x + s.handleOut.x, s.point.y + s.handleOut.y]
    }));
    
    path.remove();
    return vertices;
}
