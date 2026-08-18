import { describe, it, expect } from 'vitest';
import { 
    distSq, 
    distToSegmentSq, 
    rotatePoint, 
    getShapePath, 
    calculatePolygonArea, 
    calculatePolygonPerimeter,
    getPointAndTangentAtLength,
    getPathTotalLength
} from '../lib/geometry';

describe('Geometry Utilities', () => {
    describe('Distance and Transformations', () => {
        it('calculates squared distance correctly', () => {
            expect(distSq([0, 0], [3, 4])).toBe(25);
            expect(distSq([1, 1], [1, 1])).toBe(0);
        });

        it('calculates distance to line segment correctly', () => {
            // Point perpendicular to segment midpoint
            const dSq = distToSegmentSq([5, 5], [0, 0], [10, 0]);
            expect(dSq).toBe(25);

            // Point closest to start endpoint
            const dSqStart = distToSegmentSq([-5, 0], [0, 0], [10, 0]);
            expect(dSqStart).toBe(25);

            // Point closest to end endpoint
            const dSqEnd = distToSegmentSq([15, 0], [0, 0], [10, 0]);
            expect(dSqEnd).toBe(25);
        });

        it('rotates points accurately around an origin', () => {
            const rotated90 = rotatePoint([10, 0], [0, 0], Math.PI / 2);
            expect(Math.round(rotated90[0])).toBe(0);
            expect(Math.round(rotated90[1])).toBe(10);

            const rotated180 = rotatePoint([10, 0], [0, 0], Math.PI);
            expect(Math.round(rotated180[0])).toBe(-10);
            expect(Math.round(rotated180[1])).toBe(0);
        });
    });

    describe('Shape Path Generation', () => {
        it('generates rectangle path data', () => {
            const rectPath = getShapePath('rectangle', 100, 50);
            expect(rectPath).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
        });

        it('generates rounded rectangle path data when corner radius is provided', () => {
            const roundedPath = getShapePath('rectangle', 100, 50, 10);
            expect(roundedPath).toContain('M 10 0');
            expect(roundedPath).toContain('a 10 10');
            expect(roundedPath).toContain('Z');
        });

        it('generates ellipse path data', () => {
            const ellipsePath = getShapePath('ellipse', 100, 60);
            expect(ellipsePath).toContain('M 50 0');
            expect(ellipsePath).toContain('a 50 30');
            expect(ellipsePath).toContain('Z');
        });

        it('generates polygon path for regular triangles, hexagons, stars', () => {
            const trianglePath = getShapePath('triangle', 100, 100);
            expect(trianglePath.startsWith('M')).toBe(true);
            expect(trianglePath.endsWith('Z')).toBe(true);

            const starPath = getShapePath('star', 100, 100);
            expect(starPath.startsWith('M')).toBe(true);
            expect(starPath.endsWith('Z')).toBe(true);
        });
    });

    describe('Polygon Math', () => {
        it('calculates polygon area using shoelace formula', () => {
            // 100x100 square
            const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];
            expect(calculatePolygonArea(square)).toBe(10000);

            // Right triangle base 100, height 50 -> area 2500
            const triangle: [number, number][] = [[0, 0], [100, 0], [0, 50]];
            expect(calculatePolygonArea(triangle)).toBe(2500);
        });

        it('calculates polygon perimeter correctly', () => {
            const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];
            expect(calculatePolygonPerimeter(square, true)).toBe(400);
            expect(calculatePolygonPerimeter(square, false)).toBe(300);
        });
    });

    describe('Path Geometry Sampling', () => {
        it('calculates path length and tangent point', () => {
            const linePath = 'M 0 0 L 100 0';
            const totalLen = getPathTotalLength(linePath);
            expect(totalLen).toBe(100);

            const mid = getPointAndTangentAtLength(linePath, 50);
            expect(mid).not.toBeNull();
            if (mid) {
                expect(Math.round(mid.point[0])).toBe(50);
                expect(Math.round(mid.point[1])).toBe(0);
                expect(Math.round(mid.angle)).toBe(0);
            }
        });
    });
});
