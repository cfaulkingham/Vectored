import React, { useMemo } from 'react';
import type { HoverInfo, InteractionState, Layer, PolygonObject, RenderableElement } from '../../types';

interface PolygonAdornmentsProps {
    editingMode: 'shape' | 'clip' | 'layer';
    activeTool: string;
    activeLayerId: string | null;
    layers: { layer: Layer; elements: RenderableElement[] }[];
    hoverInfo: HoverInfo | null;
    interaction: InteractionState;
    width: number;
    height: number;
    zoom: number;
}

const HANDLE_SIZE = 4;
const ANCHOR_SIZE = 5;

export const PolygonAdornments: React.FC<PolygonAdornmentsProps> = ({
    editingMode,
    activeTool,
    activeLayerId,
    layers,
    hoverInfo,
    interaction,
    width,
    height,
    zoom,
}) => {
    return useMemo(() => {
        const objectsToRender: PolygonObject[] = [];
        const activeLayerForAdornments = layers.find(l => l.layer.id === activeLayerId)?.layer;

        if (interaction.mode === 'drawing_polygon') {
            objectsToRender.push(interaction.object);
        } else if (
            activeLayerForAdornments &&
            (interaction.mode === 'moving_polygon_anchor' || interaction.mode === 'moving_polygon_handle' || interaction.mode === 'moving_polygon_segment')
        ) {
            const obj = activeLayerForAdornments.objects.find(o => o.id === interaction.objectId) as PolygonObject | undefined;
            if (obj) {
                objectsToRender.push(obj);
            }
        } else if (editingMode === 'shape' && activeTool === 'node' && activeLayerForAdornments) {
            const polygons = activeLayerForAdornments.objects.filter(o => o.type === 'polygon') as PolygonObject[];
            objectsToRender.push(...polygons);
        }

        if (objectsToRender.length === 0) return null;
    
        let layerTransform = '';
        if (activeLayerForAdornments) {
            const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayerForAdornments;
            const pivotX = width / 2;
            const pivotY = height / 2;
            layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;
        }
    
        const effectiveZoom = (activeLayerForAdornments?.scale || 1) * zoom;
        const dynamicHandleSize = HANDLE_SIZE / effectiveZoom;
        const dynamicAnchorSize = ANCHOR_SIZE / effectiveZoom;
        const dynamicHandleStrokeWidth = 1 / effectiveZoom;
        const dynamicAnchorStrokeWidth = 2 / effectiveZoom;

        return (
            <g transform={layerTransform} style={{ pointerEvents: 'none' }}>
                {objectsToRender.map(obj => {
                    const points = obj.points;
                    if (!points || points.length === 0) return null;
    
                    const cx = obj.x + obj.width / 2;
                    const cy = obj.y + obj.height / 2;
                    const objectTransform = `translate(${cx}, ${cy}) rotate(${obj.rotation}) skewX(${obj.skewX || 0}) skewY(${obj.skewY || 0}) translate(${-cx}, ${-cy})`;

                    const isDragActiveOnThisObject = (
                        interaction.mode === 'moving_polygon_anchor' ||
                        interaction.mode === 'moving_polygon_handle' ||
                        interaction.mode === 'moving_polygon_segment'
                    ) && interaction.objectId === obj.id;
    
                    return (
                        <g key={obj.id} transform={objectTransform}>
                            {points.map((p, i) => {
                                const isThisNodeBeingDragged = (
                                    (interaction.mode === 'moving_polygon_anchor' || interaction.mode === 'moving_polygon_handle') &&
                                    interaction.objectId === obj.id &&
                                    interaction.vertexIndex === i
                                );

                                if (isDragActiveOnThisObject && !isThisNodeBeingDragged) {
                                    return null;
                                }

                                const isHoveredAnchor = hoverInfo?.type === 'polygon_anchor' && hoverInfo.objectId === obj.id && hoverInfo.vertexIndex === i;
                                const isHoveredHandle = hoverInfo?.type === 'polygon_handle' && hoverInfo.objectId === obj.id && hoverInfo.vertexIndex === i;
                                const isMovingAnchor = interaction.mode === 'moving_polygon_anchor' && interaction.objectId === obj.id && interaction.vertexIndex === i;
                                const isMovingHandle = interaction.mode === 'moving_polygon_handle' && interaction.objectId === obj.id && interaction.vertexIndex === i;
                                const isInteracting = isMovingAnchor || isMovingHandle;
                                const isDrawing = interaction.mode === 'drawing_polygon' && interaction.object.id === obj.id && interaction.vertexIndex === i;
                                const isNearStartToClose = (hoverInfo as any)?.type === 'close_polygon' && interaction.mode === 'drawing_polygon' && interaction.object.id === obj.id && i === 0;
                                
                                const isMovingHandle1 = isMovingHandle && interaction.mode === 'moving_polygon_handle' && interaction.handleKey === 'handle1';
                                const isMovingHandle2 = isMovingHandle && interaction.mode === 'moving_polygon_handle' && interaction.handleKey === 'handle2';
    
                                const hasHandle1 = p.handle1[0] !== p.anchor[0] || p.handle1[1] !== p.anchor[1];
                                const hasHandle2 = p.handle2[0] !== p.anchor[0] || p.handle2[1] !== p.anchor[1];
                                
                                const showHandles = isHoveredAnchor || isHoveredHandle || isInteracting || isDrawing || hasHandle1 || hasHandle2;
    
                                return (
                                    <g key={i}>
                                        {showHandles && (
                                            <g>
                                                {(hasHandle1 || isMovingHandle1) && <line x1={p.anchor[0]} y1={p.anchor[1]} x2={p.handle1[0]} y2={p.handle1[1]} stroke="rgba(34, 211, 238, 0.6)" strokeWidth={dynamicHandleStrokeWidth} />}
                                                {(hasHandle2 || isMovingHandle2) && <line x1={p.anchor[0]} y1={p.anchor[1]} x2={p.handle2[0]} y2={p.handle2[1]} stroke="rgba(34, 211, 238, 0.6)" strokeWidth={dynamicHandleStrokeWidth} />}
                                                
                                                {hasHandle1 && !isMovingHandle1 && <circle cx={p.handle1[0]} cy={p.handle1[1]} r={dynamicHandleSize} fill="rgb(34, 211, 238)" stroke="white" strokeWidth={dynamicHandleStrokeWidth} style={{ pointerEvents: 'auto' }} />}
                                                {hasHandle2 && !isMovingHandle2 && <circle cx={p.handle2[0]} cy={p.handle2[1]} r={dynamicHandleSize} fill="rgb(34, 211, 238)" stroke="white" strokeWidth={dynamicHandleStrokeWidth} style={{ pointerEvents: 'auto' }} />}
                                            </g>
                                        )}
                                        {!isMovingAnchor && (
                                            <circle 
                                                cx={p.anchor[0]} 
                                                cy={p.anchor[1]} 
                                                r={isHoveredAnchor || isNearStartToClose ? dynamicAnchorSize * 1.4 : dynamicAnchorSize}
                                                fill={isNearStartToClose ? 'rgb(34, 197, 94)' : 'white'}
                                                stroke={isNearStartToClose ? 'white' : 'rgb(34, 211, 238)'}
                                                strokeWidth={dynamicAnchorStrokeWidth}
                                                className={isNearStartToClose ? 'animate-pulse' : ''}
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
            </g>
        );
    }, [editingMode, activeLayerId, layers, width, height, hoverInfo, interaction, activeTool, zoom]);
};
