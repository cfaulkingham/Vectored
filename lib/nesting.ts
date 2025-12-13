
import paper from 'paper';
import type { VectorObject, NestingResult, NestedPlacement } from '../types';
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
 * Converts a VectorObject to a Paper.js PathItem.
 * Normalizes the object by removing rotation/skew to get its canonical footprint.
 * 
 * @param obj - The vector object to convert.
 * @returns The Paper.js PathItem, or null if conversion failed.
 */
// FIX: Changed return type to CompoundPath to allow access to area property.
const objectToPaperPath = (obj: VectorObject): paper.CompoundPath | null => {
    // Create a canonical version of the object with zero rotation.
    const canonicalObj = { ...obj, rotation: 0, skewX: 0, skewY: 0 };
    
    const pathData = getSVGPathFromObject(canonicalObj);
    if (!pathData) return null;
    
    try {
        const paperPath = new paper.CompoundPath(pathData);
        
        // Normalize position to 0,0 relative to bounds top-left
        const b = paperPath.bounds;
        paperPath.translate(new paper.Point(-b.x, -b.y));
        
        // Ensure path is closed and filled for robust boolean operations
        if (!paperPath.closed) {
            paperPath.closed = true;
        }
        paperPath.fillColor = new paper.Color('black');
        
        // Fix winding rules
        paperPath.reorient();
        
        return paperPath;
    } catch (e) {
        return null;
    }
};

/**
 * Helper to safe get a point on the boundary of a PathItem.
 * Handles both simple Path and CompoundPath (which lacks getPointAt in older paper.js versions).
 */
const getBoundaryPoint = (item: paper.PathItem): paper.Point => {
    if (item instanceof paper.Path) {
        return item.getPointAt(0);
    }
    if (item instanceof paper.CompoundPath && item.children && item.children.length > 0) {
        // Get point from the first child path
        const child = item.children[0];
        if (child instanceof paper.Path) {
            return child.getPointAt(0);
        }
    }
    // Fallback to a bounds point if structure is unexpected
    return item.bounds.topLeft;
};

/**
 * Robust collision check between two Paper.js items.
 * Uses Bounding Box pre-check, then outline intersection, then containment check.
 * 
 * @param item1 - The first path item.
 * @param item2 - The second path item.
 * @param padding - Optional padding distance around items.
 * @returns True if the items collide or overlap.
 */
const checkCollision = (item1: paper.PathItem, item2: paper.PathItem, padding: number = 0): boolean => {
    // 1. Fast Bounding Box Check.
    // Expand one item's bounds by the padding and check against the other's original bounds.
    const b1Padded = item1.bounds.clone().expand(padding);
    if (!b1Padded.intersects(item2.bounds)) {
        return false;
    }

    // 2. Check for outline intersections.
    // If the paths cross, it's a definite collision.
    const crossings = item1.getCrossings(item2);
    if (crossings.length > 0) {
        return true;
    }

    // 3. Check for containment.
    // If outlines don't cross, one might be fully inside the other.
    // We check if a point on the boundary of one shape is inside the other.
    
    const p1 = getBoundaryPoint(item1);
    if (item2.contains(p1)) {
        return true;
    }
    
    const p2 = getBoundaryPoint(item2);
    if (item1.contains(p2)) {
        return true;
    }

    return false;
};

interface NestingOptions {
    padding: number;
    canvasWidth: number;
    canvasHeight: number;
    iterations: number;
    rotate: boolean;
}

/**
 * Heuristic Bottom-Left Nesting Algorithm with robust collision detection.
 * Arranges objects to minimize wasted space within a given canvas size.
 * 
 * @param objects - The list of vector objects to nest.
 * @param options - Nesting configuration (padding, dimensions, rotation support).
 * @returns The result containing new placements, fitness score, and used bounds.
 */
export const nestObjects = (objects: VectorObject[], options: NestingOptions): NestingResult => {
    initPaper();
    // Clear context to prevent ID collisions or leaks
    paper.project.activeLayer.removeChildren();

    const { padding, canvasWidth, canvasHeight, rotate } = options;
    
    // Resolution: Step size for the grid search.
    const resolution = Math.max(2, Math.min(canvasWidth, canvasHeight) / 100);

    // FIX: Changed PathItem to CompoundPath to get access to .area property.
    const items: { id: string, item: paper.CompoundPath, originalArea: number }[] = [];

    // 1. Prepare Items
    objects.forEach(obj => {
        if (obj.type === 'group' || obj.type === 'flow-guide' || obj.type === 'image' || obj.type === 'measurement') return;

        const item = objectToPaperPath(obj);
        if (item) {
            items.push({ id: obj.id, item, originalArea: Math.abs(item.area) });
        }
    });

    // 2. Sort by Area Descending (Largest First)
    items.sort((a, b) => b.originalArea - a.originalArea);

    // FIX: Changed PathItem to CompoundPath to match `item.clone()` return type and get access to .area property.
    const placedItems: paper.CompoundPath[] = [];
    const placements: NestedPlacement[] = [];

    // 3. Place Items
    for (const { id, item } of items) {
        let bestPos: paper.Point | null = null;
        let bestRot = 0;
        let found = false;

        const rotations = rotate ? [0, 90, 180, 270] : [0];

        searchLoop:
        for (let r = 0; r < rotations.length; r++) {
            const rot = rotations[r];
            const rotatedItem = item.clone();
            
            rotatedItem.rotate(rot, new paper.Point(0,0)); 
            
            const b = rotatedItem.bounds;
            rotatedItem.translate(new paper.Point(-b.x, -b.y)); 

            // Scan grid
            for (let y = padding; y < canvasHeight - b.height - padding; y += resolution) {
                for (let x = padding; x < canvasWidth - b.width - padding; x += resolution) {
                    
                    const centerX = x + b.width / 2;
                    const centerY = y + b.height / 2;
                    rotatedItem.position = new paper.Point(centerX, centerY);
                    
                    let collision = false;

                    for (const placed of placedItems) {
                        if (checkCollision(rotatedItem, placed, padding)) {
                            collision = true;
                            break;
                        }
                    }

                    if (!collision) {
                        bestPos = rotatedItem.position;
                        bestRot = rot;
                        found = true;
                        break searchLoop;
                    }
                }
            }
            rotatedItem.remove();
        }

        if (found && bestPos) {
            const placedClone = item.clone();
            
            placedClone.rotate(bestRot, new paper.Point(0,0));
            const b = placedClone.bounds;
            placedClone.translate(new paper.Point(-b.x, -b.y));
            placedClone.position = bestPos;
            
            placedItems.push(placedClone);
            
            placements.push({
                id,
                x: bestPos.x,
                y: bestPos.y,
                rotation: bestRot
            });
        }
        
        item.remove();
    }

    let usedArea = 0;
    // FIX: Property 'area' does not exist on type 'PathItem'. Now it does on `paper.CompoundPath`.
    placedItems.forEach(i => usedArea += Math.abs(i.area));
    
    let maxX = 0, maxY = 0;
    placedItems.forEach(i => {
        if (i.bounds.right > maxX) maxX = i.bounds.right;
        if (i.bounds.bottom > maxY) maxY = i.bounds.bottom;
    });

    const boundingArea = maxX * maxY;
    const fitness = boundingArea > 0 ? usedArea / boundingArea : 0;

    paper.project.activeLayer.removeChildren();

    return {
        placements,
        fitness,
        generation: 1,
        bounds: { width: maxX, height: maxY }
    };
};
