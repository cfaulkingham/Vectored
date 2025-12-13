
import paper from 'paper';
import type { VectorObject, GenericPathObject } from '../types';
import { getSVGPathFromObject } from './geometry';

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
 * Converts a VectorObject to a Paper.js Path or CompoundPath.
 * Handles transformations by applying them directly to the path data before creation.
 *
 * @param {VectorObject} obj - The vector object to convert.
 * @returns {paper.PathItem | null} The Paper.js path item, or null if conversion failed.
 */
const objectToPaperPath = (obj: VectorObject): paper.PathItem | null => {
    const pathData = getSVGPathFromObject(obj);
    if (!pathData) return null;

    try {
        // Create path directly from SVG path data string using CompoundPath.
        // This avoids 'importSVG' treating the string as a URL if it's not wrapped in <svg>.
        // CompoundPath handles both simple paths and paths with holes/multiple sub-paths.
        const paperPath = new paper.CompoundPath(pathData);
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
 * @param {VectorObject[]} objects - The array of objects to operate on. Order matters (bottom to top).
 * @param {'unite' | 'subtract' | 'intersect' | 'exclude'} operation - The type of boolean operation.
 * @returns {GenericPathObject | null} A new GenericPathObject representing the result, or null if the operation failed or result was empty.
 */
export const performBooleanOperation = (
    objects: VectorObject[], 
    operation: 'unite' | 'subtract' | 'intersect' | 'exclude'
): GenericPathObject | null => {
    if (objects.length < 2) return null;

    initPaper();
    
    // Clear any existing items in the project to ensure a clean slate
    // This is important because we create new items in objectToPaperPath which get added to the activeLayer
    paper.project.activeLayer.removeChildren();

    const paperPaths = objects.map(objectToPaperPath).filter(Boolean) as paper.PathItem[];
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
                    // Subtract NEXT (top) from RESULT (bottom/accumulated). 
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
            
            // Safer cleanup: The result of a boolean op can be one of the operands.
            // Only remove paths that are not the new result.
            if (resultPath !== tempResult) {
                resultPath.remove();
            }
            if (nextPath !== tempResult) {
                nextPath.remove();
            }
            
            resultPath = tempResult;

        } catch (e) {
            console.error("Boolean operation failed:", e);
            // Clean up remaining paths on failure
            paperPaths.forEach(p => p.remove());
            return null;
        }
    }

    if (resultPath.isEmpty()) {
        paper.project.activeLayer.removeChildren();
        return null;
    }

    // Get the bounding box of the result in world coordinates
    const { x, y, width, height } = resultPath.bounds;

    // Normalize path position to (0,0) so that x/y properties control placement.
    // This prevents double-offsetting when the renderer tries to align path data.
    resultPath.translate(new paper.Point(-x, -y));

    // Export result back to SVG path string
    const pathData = resultPath.pathData;
    if (!pathData) return null;

    // Cleanup paperJS items from the canvas
    paper.project.activeLayer.removeChildren();

    // Create result object
    // We inherit visual properties from the lowest object (the first one)
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
};
