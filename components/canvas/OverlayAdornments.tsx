import React, { useMemo } from 'react';
import type { HoverInfo, InteractionState, Layer, Point, PolygonObject, RenderableElement } from '../../types';
import { getTransformMatrix, transformPoint, transformLayerLocalPointToWorld } from '../../lib/geometry';

interface OverlayAdornmentsProps {
    activeTool: string;
    hoverInfo: HoverInfo | null;
    interaction: InteractionState;
    mouseWorldPos: Point | null;
    isShiftPressed: boolean;
    layers: { layer: Layer; elements: RenderableElement[] }[];
    viewState: { zoom: number; pan: { x: number; y: number } };
    rulerBreadth: number;
    width: number;
    height: number;
}

export const OverlayAdornments: React.FC<OverlayAdornmentsProps> = ({
    activeTool,
    hoverInfo,
    interaction,
    mouseWorldPos,
    isShiftPressed,
    layers,
    viewState,
    rulerBreadth,
    width,
    height,
}) => {
    return useMemo(() => {
        if (activeTool !== 'node' || !hoverInfo || interaction.mode !== 'idle') return null;

        const adornmentStyle: React.CSSProperties = {
            pointerEvents: 'none',
            fontSize: '16px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            stroke: 'white',
            strokeWidth: 3,
            paintOrder: 'stroke',
            userSelect: 'none',
        };

        // '+' on segment hover
        if (hoverInfo.type === 'polygon_segment' && mouseWorldPos) {
            const screenX = mouseWorldPos[0] * viewState.zoom + viewState.pan.x + rulerBreadth;
            const screenY = mouseWorldPos[1] * viewState.zoom + viewState.pan.y + rulerBreadth;
            return (
                <text x={screenX} y={screenY} dy="0.35em" textAnchor="middle" style={{ ...adornmentStyle, fill: 'rgb(34, 211, 238)' }}>
                    +
                </text>
            );
        }

        // '-' on anchor shift-hover
        if (hoverInfo.type === 'polygon_anchor' && isShiftPressed) {
            const layer = layers.find(l => l.layer.id === hoverInfo.layerId)?.layer;
            const object = layer?.objects.find(o => o.id === hoverInfo.objectId) as PolygonObject;
            if (object && layer) {
                const vertex = object.points[hoverInfo.vertexIndex];
                if (vertex) {
                    const objectMatrix = getTransformMatrix(object);
                    const layerLocalAnchorPos = transformPoint(vertex.anchor, objectMatrix);
                    
                    const finalWorldPos = transformLayerLocalPointToWorld(layerLocalAnchorPos, layer, { width, height });

                    const screenX = finalWorldPos[0] * viewState.zoom + viewState.pan.x + rulerBreadth;
                    const screenY = finalWorldPos[1] * viewState.zoom + viewState.pan.y + rulerBreadth;

                    return (
                        <text x={screenX} y={screenY} dy="0.35em" textAnchor="middle" style={{ ...adornmentStyle, fill: '#ef4444' }}>
                            -
                        </text>
                    );
                }
            }
        }
        
        return null;
    }, [activeTool, hoverInfo, interaction.mode, mouseWorldPos, isShiftPressed, layers, viewState, rulerBreadth, width, height]);
};
