import React from 'react';
import type { PolygonVertex, HoverInfo, InteractionState, Layer } from '../../types';
import { getPolygonPathWithCurves } from '../../lib/geometry';

interface ClipModeAdornmentsProps {
    editingMode: 'shape' | 'clip' | 'layer';
    activeLayer: Layer | undefined;
    activeLayerClipPolygonPoints: PolygonVertex[];
    isLayerClipPolygonClosed: boolean;
    hoverInfo: HoverInfo | null;
    interaction: InteractionState;
    width: number;
    height: number;
    zoom: number;
}

const HANDLE_SIZE = 4;
const ANCHOR_SIZE = 5;

export const ClipModeAdornments: React.FC<ClipModeAdornmentsProps> = ({
    editingMode,
    activeLayer,
    activeLayerClipPolygonPoints,
    isLayerClipPolygonClosed,
    hoverInfo,
    interaction,
    width,
    height,
    zoom,
}) => {
    if (editingMode !== 'clip' || !activeLayer) return null;

    const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayer;
    const effectiveZoom = layerScale * zoom;
    const dynamicHandleSize = HANDLE_SIZE / effectiveZoom;
    const dynamicAnchorSize = ANCHOR_SIZE / effectiveZoom;
    const dynamicStrokeWidth = 1.5 / effectiveZoom;
    const dynamicHandleStrokeWidth = 1 / effectiveZoom;

    const pivotX = width / 2;
    const pivotY = height / 2;
    const transform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;

    const points = activeLayerClipPolygonPoints;
    if (!points) return null;
    const isClosed = isLayerClipPolygonClosed;
    const path = getPolygonPathWithCurves(points, isClosed);
    const startColor = 'rgb(34, 197, 94)';
    const isNearStart = (hoverInfo?.type === 'close_polygon') || (hoverInfo?.type === 'anchor' && hoverInfo.vertexIndex === 0 && !isClosed && points.length > 2);
    
    const isMoving = interaction.mode === 'moving_clip_path';
    const isHoveredOnHandle = hoverInfo?.type === 'layer_handle';
    const handleStrokeColor = isHoveredOnHandle || isMoving ? 'rgb(56, 189, 248)' : 'rgba(0, 0, 0, 0.4)';
    const handleSize = 10;
    const handleX = width / 2 + offsetX;
    const handleY = height / 2 + offsetY;

    return (
        <>
            <g transform={transform}>
                {points.length > 0 && <path d={path} fill={isClosed ? "rgba(0, 0, 0, 0.1)" : "none"} stroke="#cccccc" strokeWidth={dynamicStrokeWidth * (2 / 1.5)} />}
                
                {hoverInfo?.type === 'segment' && interaction.mode === 'idle' && (
                    <path 
                        d={`M ${points[hoverInfo.segmentIndex].anchor.join(',')} L ${points[(hoverInfo.segmentIndex + 1) % points.length].anchor.join(',')}`}
                        stroke="rgba(56, 189, 248, 0.8)"
                        strokeWidth={dynamicStrokeWidth * (6 / 1.5)}
                        strokeLinecap="round"
                    />
                )}

                {!isMoving && points.map((p, i) => {
                    const isHovered = (hoverInfo?.type === 'anchor' || hoverInfo?.type === 'handle') && hoverInfo.vertexIndex === i;
                    const isInteracting = (interaction.mode === 'moving_anchor' || interaction.mode === 'moving_handle' || interaction.mode === 'drawing') && interaction.vertexIndex === i;
                    const showHandles = isHovered || isInteracting;
                    
                    const isDrawingTip = interaction.mode === 'drawing' && i === points.length - 1;
                    const isMovingThisAnchor = interaction.mode === 'moving_anchor' && interaction.vertexIndex === i;
                    const isMovingHandle1 = interaction.mode === 'moving_handle' && interaction.vertexIndex === i && interaction.handleKey === 'handle1';
                    const isMovingHandle2 = interaction.mode === 'moving_handle' && interaction.vertexIndex === i && interaction.handleKey === 'handle2';

                    const hasHandle1 = p.handle1[0] !== p.anchor[0] || p.handle1[1] !== p.anchor[1];
                    const hasHandle2 = p.handle2[0] !== p.anchor[0] || p.handle2[1] !== p.anchor[1];

                    return (
                        <g key={i}>
                            {(showHandles || isDrawingTip) && (
                                <g>
                                    {(hasHandle1 || isMovingHandle1) && <line x1={p.anchor[0]} y1={p.anchor[1]} x2={p.handle1[0]} y2={p.handle1[1]} stroke="cyan" strokeWidth={dynamicHandleStrokeWidth} />}
                                    {(hasHandle2 || isMovingHandle2) && <line x1={p.anchor[0]} y1={p.anchor[1]} x2={p.handle2[0]} y2={p.handle2[1]} stroke="cyan" strokeWidth={dynamicHandleStrokeWidth} />}
                                    
                                    {hasHandle1 && !isMovingHandle1 && <circle cx={p.handle1[0]} cy={p.handle1[1]} r={dynamicHandleSize} fill="cyan" stroke="white" strokeWidth={dynamicHandleStrokeWidth} />}
                                    {hasHandle2 && !isMovingHandle2 && <circle cx={p.handle2[0]} cy={p.handle2[1]} r={dynamicHandleSize} fill="cyan" stroke="white" strokeWidth={dynamicHandleStrokeWidth} />}
                                </g>
                            )}
                            {!isMovingThisAnchor && (
                                <circle 
                                    cx={p.anchor[0]} 
                                    cy={p.anchor[1]} 
                                    r={isHovered || (isNearStart && i === 0) ? dynamicAnchorSize * 1.4 : dynamicAnchorSize}
                                    fill={i === 0 ? startColor : "white"} 
                                    stroke={isNearStart && i === 0 ? 'white' : 'cyan'}
                                    strokeWidth={dynamicStrokeWidth}
                                    className={isNearStart && i === 0 ? 'animate-pulse' : ''}
                                />
                            )}
                        </g>
                    );
                })}
            </g>

            {/* Layer Move Handle */}
            <g style={{ pointerEvents: 'none' }}>
                <circle cx={handleX} cy={handleY} r={handleSize / zoom} fill={isMoving ? "rgba(56, 189, 248, 0.3)" : "rgba(0, 0, 0, 0.1)"} stroke={handleStrokeColor} strokeWidth={1.5 / zoom} />
                <line x1={handleX - handleSize / 2 / zoom} y1={handleY} x2={handleX + handleSize / 2 / zoom} y2={handleY} stroke={handleStrokeColor} strokeWidth={1.5 / zoom} />
                <line x1={handleX} y1={handleY - handleSize / 2 / zoom} x2={handleX} y2={handleY + handleSize / 2 / zoom} stroke={handleStrokeColor} strokeWidth={1.5 / zoom} />
            </g>
        </>
    );
};
