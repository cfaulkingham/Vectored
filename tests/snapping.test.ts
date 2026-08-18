import { describe, it, expect } from 'vitest';
import { calculateSnapping } from '../lib/snapping';
import type { ShapeObject } from '../types';

describe('Snapping System', () => {
    it('returns zero deltas when smart snapping is disabled and no grid', () => {
        const draggingObj: ShapeObject = {
            id: 'obj-1',
            type: 'shape',
            shapeType: 'rectangle',
            x: 52,
            y: 52,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#fff',
            stroke: '#000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal',
        };

        const result = calculateSnapping(
            [52, 52],
            { x: 52, y: 52, width: 100, height: 100 },
            [],
            { width: 1000, height: 1000 },
            { grid: false, gridSize: 10, smart: false, threshold: 5 },
            []
        );

        expect(result.guides.length).toBe(0);
        expect(result.dx).toBe(0);
        expect(result.dy).toBe(0);
    });

    it('snaps to grid when grid snapping is enabled', () => {
        const result = calculateSnapping(
            [53, 98],
            { x: 53, y: 98, width: 100, height: 100 },
            [],
            { width: 1000, height: 1000 },
            { grid: true, gridSize: 10, smart: false, threshold: 5 },
            []
        );

        expect(result.dx).toBe(-3);
        expect(result.dy).toBe(2);
    });

    it('snaps object edges to other objects with smart guides', () => {
        const targetObj: ShapeObject = {
            id: 'obj-target',
            type: 'shape',
            shapeType: 'rectangle',
            x: 200,
            y: 200,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#fff',
            stroke: '#000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal',
        };

        const result = calculateSnapping(
            [202, 400],
            { x: 202, y: 400, width: 100, height: 100 },
            [targetObj],
            { width: 1000, height: 1000 },
            { grid: false, gridSize: 10, smart: true, threshold: 5 },
            []
        );

        // 202 should snap to 200 (delta -2)
        expect(result.dx).toBe(-2);
        expect(result.guides.length).toBeGreaterThan(0);
    });
});
