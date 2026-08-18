import { describe, it, expect } from 'vitest';
import { performHitTest, calculateCanvasCursor } from '../lib/hit-test';
import { createNewLayer } from '../lib/layer-helpers';
import type { ShapeObject } from '../types';

describe('Hit Testing and Interaction Cursor System', () => {
    const sampleShape: ShapeObject = {
        id: 'shape-1',
        type: 'shape',
        shapeType: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
        fillOpacity: 1,
        strokeOpacity: 1,
        blendMode: 'normal',
    };

    const activeLayer = createNewLayer();
    activeLayer.id = 'layer-1';
    activeLayer.name = 'Layer 1';
    activeLayer.color = '#ff0000';
    activeLayer.objects = [sampleShape];

    it('identifies object body when point is inside shape bounds', () => {
        const result = performHitTest({
            worldPoint: [150, 150],
            viewState: { zoom: 1, pan: { x: 0, y: 0 } },
            interaction: { mode: 'idle' },
            editingMode: 'shape',
            activeTool: 'select',
            activeLayerId: 'layer-1',
            activeLayer,
            activeLayerClipPolygonPoints: [],
            layers: [{ layer: activeLayer, elements: [] }],
            selectedObjects: [],
            guides: [],
            width: 800,
            height: 600,
        });

        expect(result.foundInfo).not.toBeNull();
        if (result.foundInfo && result.foundInfo.type === 'object') {
            expect(result.foundInfo.type).toBe('object');
            expect(result.foundInfo.objectId).toBe('shape-1');
            expect(result.foundInfo.layerId).toBe('layer-1');
        }
    });

    it('returns null when point is outside any shape', () => {
        const result = performHitTest({
            worldPoint: [500, 500],
            viewState: { zoom: 1, pan: { x: 0, y: 0 } },
            interaction: { mode: 'idle' },
            editingMode: 'shape',
            activeTool: 'select',
            activeLayerId: 'layer-1',
            activeLayer,
            activeLayerClipPolygonPoints: [],
            layers: [{ layer: activeLayer, elements: [] }],
            selectedObjects: [],
            guides: [],
            width: 800,
            height: 600,
        });

        expect(result.foundInfo).toBeNull();
    });

    it('returns correct CSS cursor for interaction modes', () => {
        const panCursor = calculateCanvasCursor({
            isPanningState: true,
            isSpacePressed: false,
            isShiftPressed: false,
            isAltPressed: false,
            interaction: { mode: 'idle' },
            hoverInfo: null,
            editingMode: 'shape',
            activeTool: 'select',
            selectedObjects: [],
        });
        expect(panCursor).toBe('grabbing');

        const spaceCursor = calculateCanvasCursor({
            isPanningState: false,
            isSpacePressed: true,
            isShiftPressed: false,
            isAltPressed: false,
            interaction: { mode: 'idle' },
            hoverInfo: null,
            editingMode: 'shape',
            activeTool: 'select',
            selectedObjects: [],
        });
        expect(spaceCursor).toBe('grab');

        const textCursor = calculateCanvasCursor({
            isPanningState: false,
            isSpacePressed: false,
            isShiftPressed: false,
            isAltPressed: false,
            interaction: { mode: 'editing_text', layerId: 'layer-1', objectId: 'txt-1' },
            hoverInfo: null,
            editingMode: 'shape',
            activeTool: 'select',
            selectedObjects: [],
        });
        expect(textCursor).toBe('text');
    });
});
