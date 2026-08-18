import { describe, it, expect } from 'vitest';
import { performBooleanOperation } from '../lib/boolean-operations';
import type { ShapeObject } from '../types';

describe('Boolean Operations', () => {
    it('returns null when less than 2 objects are provided', () => {
        const obj: ShapeObject = {
            id: 'obj-1',
            type: 'shape',
            shapeType: 'rectangle',
            x: 0,
            y: 0,
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

        const res = performBooleanOperation([obj], 'unite');
        expect(res).toBeNull();
    });

    it('performs union of two overlapping rectangles', () => {
        const obj1: ShapeObject = {
            id: 'obj-1',
            type: 'shape',
            shapeType: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#ff0000',
            stroke: '#000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal',
        };

        const obj2: ShapeObject = {
            id: 'obj-2',
            type: 'shape',
            shapeType: 'rectangle',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#00ff00',
            stroke: '#000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal',
        };

        const res = performBooleanOperation([obj1, obj2], 'unite');
        expect(res).not.toBeNull();
        if (res) {
            expect(res.type).toBe('generic-path');
            expect(res.width).toBe(150);
            expect(res.height).toBe(150);
            expect(res.fill).toBe('#ff0000'); // Inherits visual properties of base object
        }
    });

    it('performs subtraction of two overlapping rectangles', () => {
        const obj1: ShapeObject = {
            id: 'obj-1',
            type: 'shape',
            shapeType: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#ff0000',
            stroke: '#000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal',
        };

        const obj2: ShapeObject = {
            id: 'obj-2',
            type: 'shape',
            shapeType: 'rectangle',
            x: 50,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            fill: '#00ff00',
            stroke: '#000',
            strokeWidth: 1,
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal',
        };

        const res = performBooleanOperation([obj1, obj2], 'subtract');
        expect(res).not.toBeNull();
        if (res) {
            expect(res.type).toBe('generic-path');
            expect(res.width).toBe(50);
            expect(res.height).toBe(100);
        }
    });
});
