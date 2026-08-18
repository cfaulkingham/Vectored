import { describe, it, expect } from 'vitest';
import { nestObjects } from '../lib/nesting';
import type { ShapeObject } from '../types';

describe('Nesting Algorithm', () => {
    const mockObjects: ShapeObject[] = [
        {
            id: 'box-1',
            type: 'shape',
            shapeType: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#ffffff',
            stroke: '#000000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal'
        },
        {
            id: 'box-2',
            type: 'shape',
            shapeType: 'rectangle',
            x: 300,
            y: 300,
            width: 80,
            height: 80,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#ffffff',
            stroke: '#000000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal'
        }
    ];

    it('compacts objects within canvas bounds and computes placements', () => {
        const result = nestObjects(mockObjects, {
            padding: 5,
            canvasWidth: 800,
            canvasHeight: 600,
            iterations: 1,
            rotate: true
        });

        expect(result).toBeDefined();
        expect(result.placements.length).toBe(2);
        expect(result.bounds).toBeDefined();
        expect(result.bounds.width).toBeGreaterThan(0);
        expect(result.bounds.height).toBeGreaterThan(0);

        // Placements should fit within bounds
        for (const placement of result.placements) {
            expect(placement.x).toBeGreaterThanOrEqual(0);
            expect(placement.y).toBeGreaterThanOrEqual(0);
            expect(placement.x).toBeLessThan(800);
            expect(placement.y).toBeLessThan(600);
        }
    });
});
