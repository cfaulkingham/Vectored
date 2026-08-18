import type { Point, VectorObject, ResizeHandle, GroupObject, Layer, AppState } from '../../types';
import { scale, rotatePoint, add, sub } from '../../lib/geometry';

export const OPPOSITE_HANDLE_MAP: Record<ResizeHandle, ResizeHandle> = {
    'top-left': 'bottom-right',
    'top-right': 'bottom-left',
    'bottom-left': 'top-right',
    'bottom-right': 'top-left',
    'top': 'bottom',
    'bottom': 'top',
    'left': 'right',
    'right': 'left',
    'start': 'end',
    'end': 'start'
};

export function snapAngleToDegrees(angleRad: number, stepDegrees: number = 15): number {
    const deg = (angleRad * 180) / Math.PI;
    const snappedDeg = Math.round(deg / stepDegrees) * stepDegrees;
    return (snappedDeg * Math.PI) / 180;
}

export function getGroupHandlePosition(
    bounds: { x: number; y: number; width: number; height: number },
    handle: ResizeHandle
): Point {
    let x = 0;
    let y = 0;
    if (handle.includes('left')) x = bounds.x;
    else if (handle.includes('right')) x = bounds.x + bounds.width;
    else x = bounds.x + bounds.width / 2;

    if (handle.includes('top')) y = bounds.y;
    else if (handle.includes('bottom')) y = bounds.y + bounds.height;
    else y = bounds.y + bounds.height / 2;

    return [x, y];
}

export function calculateScaleFactor(
    startDistance: number,
    currentDistance: number,
    minScale: number = 0.01
): number {
    if (startDistance <= 0) return 1;
    const factor = currentDistance / startDistance;
    return Math.max(minScale, factor);
}
