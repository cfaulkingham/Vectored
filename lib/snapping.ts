

import type { Point, VectorObject, SnapSettings, ActiveGuide, Guide } from '../types';
import { getObjectVisualBounds } from './geometry';

interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    midX: number;
    midY: number;
}

/**
 * Extracts key snapping boundaries (min, max, mid) from a vector object.
 * @param obj - The vector object.
 * @returns The boundary coordinates.
 */
function getBounds(obj: VectorObject): Bounds {
    const b = getObjectVisualBounds(obj);
    return {
        minX: b.x,
        maxX: b.x + b.width,
        minY: b.y,
        maxY: b.y + b.height,
        midX: b.x + b.width / 2,
        midY: b.y + b.height / 2,
    };
}

/**
 * Calculates snapping deltas (dx, dy) and identifies active guides.
 * Supports both Grid Snapping and Smart Guides (alignment to other objects).
 * 
 * @param currentPos - The current top-left position of the moving selection (or pivot).
 * @param selectionBounds - The bounds of the object(s) being moved.
 * @param otherObjects - List of other objects in the scene to snap to.
 * @param canvasSize - Dimensions of the canvas (for center snapping).
 * @param settings - Current snapping configuration (enabled, grid size, threshold).
 * @returns Object containing position adjustments (dx, dy) and list of visual guides.
 */
export const calculateSnapping = (
    currentPos: Point, // Top-Left or pivot point of moving selection
    selectionBounds: { x: number, y: number, width: number, height: number },
    otherObjects: VectorObject[],
    canvasSize: { width: number, height: number },
    settings: SnapSettings,
    guides: Guide[]
): { dx: number, dy: number, guides: ActiveGuide[] } => {
    
    let dx = 0;
    let dy = 0;
    const activeGuides: ActiveGuide[] = [];
    
    // 1. Grid Snapping (Lowest priority, applied to raw position first)
    if (settings.grid) {
        const size = settings.gridSize;
        // Snap Top-Left to grid
        const snappedX = Math.round(currentPos[0] / size) * size;
        const snappedY = Math.round(currentPos[1] / size) * size;
        
        dx = snappedX - currentPos[0];
        dy = snappedY - currentPos[1];
    }

    // 2. Smart Guides (Higher priority, can override grid)
    if (settings.smart) {
        const threshold = settings.threshold;
        
        // Calculate bounds of the MOVING selection (applying the initial grid-snap delta if any, or raw)
        // Actually, smart guides usually snap "instead" of grid, but let's check relative to current+gridDelta
        // If smart snap is found, we replace the grid delta.
        
        const curX = selectionBounds.x + dx;
        const curY = selectionBounds.y + dy;
        const curW = selectionBounds.width;
        const curH = selectionBounds.height;
        
        const moving = {
            minX: curX, maxX: curX + curW, midX: curX + curW/2,
            minY: curY, maxY: curY + curH, midY: curY + curH/2
        };

        let snapX = false;
        let snapY = false;
        
        // Target points to check against
        const targetsX: { val: number, start: number, end: number }[] = [
            // Canvas Center
            { val: canvasSize.width / 2, start: 0, end: canvasSize.height }
        ];
        const targetsY: { val: number, start: number, end: number }[] = [
            // Canvas Center
            { val: canvasSize.height / 2, start: 0, end: canvasSize.width }
        ];

        // Collect targets from guides
        guides.forEach(g => {
            if (g.orientation === 'vertical') {
                targetsX.push({ val: g.position, start: -Infinity, end: Infinity });
            } else {
                targetsY.push({ val: g.position, start: -Infinity, end: Infinity });
            }
        });

        // Collect targets from other objects
        // Optimization: Only check objects roughly within view or just all (simpler for now)
        otherObjects.forEach(obj => {
            const b = getBounds(obj);
            // Add vertical lines (to snap X coords)
            targetsX.push({ val: b.minX, start: b.minY, end: b.maxY });
            targetsX.push({ val: b.maxX, start: b.minY, end: b.maxY });
            targetsX.push({ val: b.midX, start: b.minY, end: b.maxY });
            
            // Add horizontal lines (to snap Y coords)
            targetsY.push({ val: b.minY, start: b.minX, end: b.maxX });
            targetsY.push({ val: b.maxY, start: b.minX, end: b.maxX });
            targetsY.push({ val: b.midY, start: b.minX, end: b.maxX });
        });

        // Helper to check match
        const checkSnap = (movingVal: number, targets: typeof targetsX, axis: 'x'|'y', currentGuideStart: number, currentGuideEnd: number) => {
            let closestDelta = Infinity;
            let bestTarget = null;

            for (const t of targets) {
                const dist = t.val - movingVal;
                if (Math.abs(dist) < threshold && Math.abs(dist) < Math.abs(closestDelta)) {
                    closestDelta = dist;
                    bestTarget = t;
                }
            }

            if (bestTarget && Math.abs(closestDelta) < threshold) {
                // We found a snap
                // If we haven't snapped this axis yet, or this one is tighter? 
                // Usually we just take the first valid one or closest.
                return { delta: closestDelta, target: bestTarget };
            }
            return null;
        };

        // X Axis (Vertical Guides)
        const candidatesX = [moving.minX, moving.midX, moving.maxX];
        let bestDeltaX = Infinity;
        let bestGuideX: ActiveGuide | null = null;

        candidatesX.forEach(val => {
            const res = checkSnap(val, targetsX, 'x', moving.minY, moving.maxY);
            if (res && Math.abs(res.delta) < Math.abs(bestDeltaX)) {
                bestDeltaX = res.delta;
                // Calculate visual guide length
                const minY = Math.min(moving.minY, res.target.start);
                const maxY = Math.max(moving.maxY, res.target.end);
                bestGuideX = { type: 'vertical', position: res.target.val, start: minY - 20, end: maxY + 20 };
            }
        });

        if (Math.abs(bestDeltaX) < threshold) {
            dx += bestDeltaX; // Apply adjustment on top of existing (or instead of grid)
            // If we snap via smart guides, we essentially align exactly to target, ignoring grid for that axis
            // Note: Since we calculated 'moving' based on 'currentPos + gridDelta', 
            // 'bestDeltaX' is the diff to reach target from grid-snapped pos.
            // So total adjustment is gridDelta + bestDeltaX.
            snapX = true;
            if (bestGuideX) activeGuides.push(bestGuideX);
        }

        // Y Axis (Horizontal Guides)
        const candidatesY = [moving.minY, moving.midY, moving.maxY];
        let bestDeltaY = Infinity;
        let bestGuideY: ActiveGuide | null = null;

        candidatesY.forEach(val => {
            const res = checkSnap(val, targetsY, 'y', moving.minX, moving.maxX);
            if (res && Math.abs(res.delta) < Math.abs(bestDeltaY)) {
                bestDeltaY = res.delta;
                const minX = Math.min(moving.minX, res.target.start);
                const maxX = Math.max(moving.maxX, res.target.end);
                bestGuideY = { type: 'horizontal', position: res.target.val, start: minX - 20, end: maxX + 20 };
            }
        });

        if (Math.abs(bestDeltaY) < threshold) {
            dy += bestDeltaY;
            snapY = true;
            if (bestGuideY) activeGuides.push(bestGuideY);
        }
    }

    return { dx, dy, guides: activeGuides };
};