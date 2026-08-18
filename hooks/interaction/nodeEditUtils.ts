import type { Point, PolygonVertex } from '../../types';
import { sub, add, scale } from '../../lib/geometry';

/**
 * Calculates new anchor and handle positions when an anchor is moved.
 * Translates handles rigidly with the anchor point.
 */
export function updateVertexAnchorPosition(
    startVertex: PolygonVertex,
    delta: Point
): PolygonVertex {
    return {
        anchor: add(startVertex.anchor, delta),
        handle1: add(startVertex.handle1, delta),
        handle2: add(startVertex.handle2, delta),
    };
}

/**
 * Updates one handle while optionally mirroring or aligning the opposite handle for smooth C1 continuity.
 */
export function updateVertexHandlePosition(
    vertex: PolygonVertex,
    activeHandleKey: 'handle1' | 'handle2',
    newHandlePos: Point,
    symmetric: boolean = true
): PolygonVertex {
    const updated = { ...vertex };
    updated[activeHandleKey] = newHandlePos;

    if (symmetric) {
        const oppositeKey = activeHandleKey === 'handle1' ? 'handle2' : 'handle1';
        const anchor = vertex.anchor;
        const diff = sub(newHandlePos, anchor);
        updated[oppositeKey] = sub(anchor, diff);
    }

    return updated;
}
