import paper from 'paper';
import type { VectorObject, NestingResult, NestedPlacement } from '../types';
import { getSVGPathFromObject } from './geometry';

let nestingScopeInstance: paper.PaperScope | null = null;

const getNestingScope = (): paper.PaperScope => {
    if (!nestingScopeInstance) {
        nestingScopeInstance = new paper.PaperScope();
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const canvas = document.createElement('canvas');
            nestingScopeInstance.setup(canvas);
        } else {
            nestingScopeInstance.setup(new nestingScopeInstance.Size(1000, 1000));
        }
    } else {
        nestingScopeInstance.activate();
    }
    return nestingScopeInstance;
};

/**
 * Converts a VectorObject to a Paper.js CompoundPath in the given scope.
 * Normalizes the object by removing rotation/skew to get its canonical footprint.
 */
const objectToPaperPath = (scope: paper.PaperScope, obj: VectorObject): paper.CompoundPath | null => {
    const canonicalObj = { ...obj, rotation: 0, skewX: 0, skewY: 0 };
    const pathData = getSVGPathFromObject(canonicalObj);
    if (!pathData) return null;
    
    try {
        scope.activate();
        const paperPath = new scope.CompoundPath(pathData);
        
        const b = paperPath.bounds;
        paperPath.translate(new scope.Point(-b.x, -b.y));
        
        if (!paperPath.closed) {
            paperPath.closed = true;
        }
        paperPath.fillColor = new scope.Color('black');
        paperPath.reorient();
        
        return paperPath;
    } catch {
        return null;
    }
};

const getBoundaryPoint = (item: paper.PathItem): paper.Point => {
    if (item instanceof paper.Path) {
        return item.getPointAt(0);
    }
    if (item instanceof paper.CompoundPath && item.children && item.children.length > 0) {
        const child = item.children[0];
        if (child instanceof paper.Path) {
            return child.getPointAt(0);
        }
    }
    return item.bounds.topLeft;
};

const checkCollision = (item1: paper.PathItem, item2: paper.PathItem, padding: number = 0): boolean => {
    const b1Padded = item1.bounds.clone().expand(padding);
    if (!b1Padded.intersects(item2.bounds)) {
        return false;
    }

    const crossings = item1.getCrossings(item2);
    if (crossings.length > 0) {
        return true;
    }

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

export interface NestingOptions {
    padding: number;
    canvasWidth: number;
    canvasHeight: number;
    iterations: number;
    rotate: boolean;
}

/**
 * Heuristic Bottom-Left Nesting Algorithm with robust collision detection.
 * Arranges objects to minimize wasted space within a given canvas size.
 */
export const nestObjects = (objects: VectorObject[], options: NestingOptions): NestingResult => {
    const scope = getNestingScope();
    scope.activate();
    scope.project.activeLayer.removeChildren();

    try {
        const { padding, canvasWidth, canvasHeight, rotate } = options;
        const resolution = Math.max(2, Math.min(canvasWidth, canvasHeight) / 100);
        const items: { id: string; item: paper.CompoundPath; originalArea: number }[] = [];

        // 1. Prepare Items
        objects.forEach(obj => {
            if (obj.type === 'group' || obj.type === 'flow-guide' || obj.type === 'image' || obj.type === 'measurement') return;

            const item = objectToPaperPath(scope, obj);
            if (item) {
                items.push({ id: obj.id, item, originalArea: Math.abs(item.area) });
            }
        });

        // 2. Sort by Area Descending (Largest First)
        items.sort((a, b) => b.originalArea - a.originalArea);

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
                
                rotatedItem.rotate(rot, new scope.Point(0,0)); 
                
                const b = rotatedItem.bounds;
                rotatedItem.translate(new scope.Point(-b.x, -b.y)); 

                // Scan grid
                for (let y = padding; y < canvasHeight - b.height - padding; y += resolution) {
                    for (let x = padding; x < canvasWidth - b.width - padding; x += resolution) {
                        
                        const centerX = x + b.width / 2;
                        const centerY = y + b.height / 2;
                        rotatedItem.position = new scope.Point(centerX, centerY);
                        
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
                
                placedClone.rotate(bestRot, new scope.Point(0,0));
                const b = placedClone.bounds;
                placedClone.translate(new scope.Point(-b.x, -b.y));
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
        placedItems.forEach(i => usedArea += Math.abs(i.area));
        
        let maxX = 0, maxY = 0;
        placedItems.forEach(i => {
            if (i.bounds.right > maxX) maxX = i.bounds.right;
            if (i.bounds.bottom > maxY) maxY = i.bounds.bottom;
        });

        const boundingArea = maxX * maxY;
        const fitness = boundingArea > 0 ? usedArea / boundingArea : 0;

        return {
            placements,
            fitness,
            generation: 1,
            bounds: { width: maxX, height: maxY }
        };
    } finally {
        scope.project?.activeLayer?.removeChildren();
    }
};
