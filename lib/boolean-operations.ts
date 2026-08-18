import paper from 'paper';
import type { VectorObject, GenericPathObject } from '../types';
import { getSVGPathFromObject } from './geometry';

/**
 * PaperScope manager for safe boolean and path operations.
 * Isolates Paper.js operations and guarantees cleanup.
 */
let paperScopeInstance: paper.PaperScope | null = null;

const getPaperScope = (): paper.PaperScope => {
    if (!paperScopeInstance) {
        paperScopeInstance = new paper.PaperScope();
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const canvas = document.createElement('canvas');
            paperScopeInstance.setup(canvas);
        } else {
            paperScopeInstance.setup(new paperScopeInstance.Size(1000, 1000));
        }
    } else {
        paperScopeInstance.activate();
    }
    return paperScopeInstance;
};

/**
 * Converts a VectorObject to a Paper.js Path or CompoundPath within the active scope.
 */
const objectToPaperPath = (scope: paper.PaperScope, obj: VectorObject): paper.PathItem | null => {
    const pathData = getSVGPathFromObject(obj);
    if (!pathData) return null;

    try {
        scope.activate();
        const paperPath = new scope.CompoundPath(pathData);
        return paperPath;
    } catch (e) {
        console.error("Failed to create Paper.js path from object:", e);
        return null;
    }
};

/**
 * Performs a boolean operation on an array of VectorObjects using Paper.js.
 * Supports union, subtraction, intersection, and exclusion.
 * 
 * @param objects - The array of objects to operate on. Order matters (bottom to top).
 * @param operation - The type of boolean operation.
 * @returns A new GenericPathObject representing the result, or null if operation failed or result was empty.
 */
export const performBooleanOperation = (
    objects: VectorObject[], 
    operation: 'unite' | 'subtract' | 'intersect' | 'exclude'
): GenericPathObject | null => {
    if (objects.length < 2) return null;

    const scope = getPaperScope();
    scope.activate();
    
    // Clear project active layer before start
    scope.project.activeLayer.removeChildren();

    try {
        const paperPaths = objects
            .map(obj => objectToPaperPath(scope, obj))
            .filter(Boolean) as paper.PathItem[];
            
        if (paperPaths.length < 2) return null;

        let resultPath: paper.PathItem = paperPaths[0];

        for (let i = 1; i < paperPaths.length; i++) {
            const nextPath = paperPaths[i];
            let tempResult: paper.PathItem;

            try {
                switch (operation) {
                    case 'unite':
                        tempResult = resultPath.unite(nextPath);
                        break;
                    case 'subtract':
                        // Subtract NEXT (top) from RESULT (bottom/accumulated)
                        tempResult = resultPath.subtract(nextPath);
                        break;
                    case 'intersect':
                        tempResult = resultPath.intersect(nextPath);
                        break;
                    case 'exclude':
                        tempResult = resultPath.exclude(nextPath);
                        break;
                    default:
                        tempResult = resultPath;
                }
                
                // Cleanup paths that are not the new result
                if (resultPath !== tempResult) {
                    resultPath.remove();
                }
                if (nextPath !== tempResult) {
                    nextPath.remove();
                }
                
                resultPath = tempResult;

            } catch (e) {
                console.error("Boolean operation step failed:", e);
                return null;
            }
        }

        if (resultPath.isEmpty()) {
            return null;
        }

        // Get bounding box of result in world coordinates
        const { x, y, width, height } = resultPath.bounds;

        // Normalize path position to (0,0) so that x/y properties control placement
        resultPath.translate(new scope.Point(-x, -y));

        // Export result back to SVG path string
        const pathData = resultPath.pathData;
        if (!pathData) return null;

        const baseObj = objects[0];
        
        return {
            id: String(Date.now()),
            type: 'generic-path',
            d: pathData,
            x: x,
            y: y,
            width: width,
            height: height,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: baseObj.fill,
            stroke: baseObj.stroke,
            strokeWidth: baseObj.strokeWidth,
            strokeLinecap: baseObj.strokeLinecap,
            strokeLinejoin: baseObj.strokeLinejoin,
            strokeDasharray: baseObj.strokeDasharray,
            strokeDashoffset: baseObj.strokeDashoffset,
            opacity: baseObj.opacity,
            fillOpacity: baseObj.fillOpacity,
            strokeOpacity: baseObj.strokeOpacity,
            blendMode: baseObj.blendMode
        };
    } finally {
        // Guaranteed cleanup of all Paper.js objects
        scope.project?.activeLayer?.removeChildren();
    }
};
