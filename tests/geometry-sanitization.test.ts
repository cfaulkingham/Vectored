import { describe, it, expect } from 'vitest';
import {
    pruneDuplicateVertices,
    pruneColinearVertices,
    normalizePolygonWinding,
    calculateKerfOffset
} from '../lib/geometry';
import type { Point } from '../types';

describe('Geometry Sanitization & Fabrication Utilities', () => {
    describe('pruneDuplicateVertices', () => {
        it('removes consecutive duplicate points within epsilon', () => {
            const points: Point[] = [
                [0, 0],
                [0.00001, 0.00001],
                [10, 10],
                [10, 10],
                [20, 20]
            ];
            const cleaned = pruneDuplicateVertices(points, 0.001);
            expect(cleaned).toEqual([
                [0, 0],
                [10, 10],
                [20, 20]
            ]);
        });

        it('preserves unique points', () => {
            const points: Point[] = [[0, 0], [1, 1], [2, 0]];
            const cleaned = pruneDuplicateVertices(points);
            expect(cleaned).toEqual(points);
        });
    });

    describe('pruneColinearVertices', () => {
        it('removes intermediate points lying on a straight line', () => {
            const points: Point[] = [
                [0, 0],
                [5, 5],
                [10, 10],
                [10, 20],
                [10, 30]
            ];
            const cleaned = pruneColinearVertices(points);
            expect(cleaned).toEqual([
                [0, 0],
                [10, 10],
                [10, 30]
            ]);
        });
    });

    describe('normalizePolygonWinding', () => {
        it('ensures clockwise winding when requested', () => {
            // Counter-clockwise rectangle
            const ccw: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
            const cw = normalizePolygonWinding(ccw, true);
            
            // Calculate signed area of result (should be negative for CW in standard screen coords)
            let signedArea = 0;
            for (let i = 0; i < cw.length; i++) {
                const p1 = cw[i];
                const p2 = cw[(i + 1) % cw.length];
                signedArea += (p1[0] * p2[1] - p2[0] * p1[1]);
            }
            expect(signedArea).toBeLessThan(0);
        });
    });

    describe('calculateKerfOffset', () => {
        it('expands a square outward by kerf offset', () => {
            // Clockwise unit square
            const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
            const offset = calculateKerfOffset(square, 1, true);
            expect(offset.length).toBe(4);
            // Points should be moved away from center
            expect(offset[0][0]).toBeLessThan(0);
            expect(offset[0][1]).toBeLessThan(0);
        });
    });
});
