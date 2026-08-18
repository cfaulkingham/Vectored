import { describe, it, expect } from 'vitest';
import { generateDXFString } from '../lib/export-helpers';
import type { AppState, Layer, ShapeObject, LineObject } from '../types';

describe('DXF Export Generator', () => {
    const mockCircle: ShapeObject = {
        id: 'circle-1',
        type: 'shape',
        shapeType: 'ellipse',
        x: 50,
        y: 50,
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
    };

    const mockLine: LineObject = {
        id: 'line-1',
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        fill: 'none',
        stroke: '#FF0000',
        strokeWidth: 1,
        opacity: 1,
        fillOpacity: 1,
        strokeOpacity: 1,
        blendMode: 'normal'
    };

    const mockLayer = {
        id: 'layer-1',
        name: 'Cut Layer',
        visible: true,
        isLocked: false,
        color: '#FF0000',
        blendMode: 'normal',
        opacity: 1,
        points: [],
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        settings: { patternType: 'none', parameters: {} },
        clipPolygonPoints: [],
        isClipPolygonClosed: false,
        useClipping: false,
        clipMode: 'normal',
        objects: [mockCircle, mockLine]
    } as unknown as Layer;

    const mockState: AppState = {
        canvasConfig: { width: 800, height: 600 },
        activeLayerId: 'layer-1',
        layers: [mockLayer],
        guides: []
    };

    it('generates valid DXF with HEADER, TABLES, and ENTITIES sections', () => {
        const dxf = generateDXFString(mockState, 'mm');
        expect(dxf).toContain('SECTION\n2\nHEADER');
        expect(dxf).toContain('SECTION\n2\nTABLES');
        expect(dxf).toContain('SECTION\n2\nENTITIES');
        expect(dxf).toContain('Cut Layer');
    });

    it('exports circles as native CIRCLE entities for machine precision', () => {
        const dxf = generateDXFString(mockState, 'mm');
        expect(dxf).toContain('0\nCIRCLE');
        expect(dxf).toContain('AcDbCircle');
    });

    it('exports lines as LINE entities', () => {
        const dxf = generateDXFString(mockState, 'mm');
        expect(dxf).toContain('0\nLINE');
        expect(dxf).toContain('AcDbLine');
    });
});
