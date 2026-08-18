import React, { useMemo } from 'react';
import type { InteractionState, Layer, RenderableElement, ResizeHandle, VectorObject } from '../../types';
import { calculateGroupBounds, getObjectVisualBounds } from '../../lib/geometry';

interface SelectionAdornmentsProps {
    selectedObjects: VectorObject[];
    interaction: InteractionState;
    editingMode: 'shape' | 'clip' | 'layer';
    activeTool: string;
    activeLayerId: string | null;
    layers: { layer: Layer; elements: RenderableElement[] }[];
    zoom: number;
    width: number;
    height: number;
}

export const SelectionAdornments: React.FC<SelectionAdornmentsProps> = ({
    selectedObjects,
    interaction,
    editingMode,
    activeTool,
    activeLayerId,
    layers,
    zoom,
    width,
    height,
}) => {
    return useMemo(() => {
        if (selectedObjects.length === 0 || 
            interaction.mode === 'editing_text' || 
            editingMode !== 'shape' ||
            activeTool === 'node' ||
            interaction.mode === 'moving_polygon_anchor' ||
            interaction.mode === 'moving_polygon_handle' ||
            interaction.mode === 'moving_polygon_segment' ||
            interaction.mode === 'drawing_polygon'
        ) return null;

        const activeLayerForAdornments = layers.find(l => l.layer.id === activeLayerId)?.layer;
        let layerTransform = '';
        if (activeLayerForAdornments) {
            const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayerForAdornments;
            const pivotX = width / 2;
            const pivotY = height / 2;
            layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;
        }

        const isSingleSelection = selectedObjects.length === 1;
        const activeLayerScale = activeLayerForAdornments?.scale || 1;
        const strokeW = 1 / (zoom * activeLayerScale);
        const paddingVal = 0;

        let w: number;
        let h: number;
        let objectTransform: string;
        let handleTransform: string;
        let handles: ResizeHandle[] = [];
        const handleSize = 8 * strokeW;
        const rotHandleOffset = (20 / zoom) + paddingVal;
        
        if (isSingleSelection) {
            const obj = selectedObjects[0];
            if (obj.type === 'measurement') {
                const bounds = getObjectVisualBounds(obj);
                w = bounds.width;
                h = bounds.height;
                const cx = bounds.x + w / 2;
                const cy = bounds.y + h / 2;
                objectTransform = `translate(${cx}, ${cy}) translate(${-w / 2}, ${-h / 2})`;
                handleTransform = `translate(${cx}, ${cy})`;
            } else {
                w = obj.width;
                h = obj.height;
                const cx = obj.x + w / 2;
                const cy = obj.y + h / 2;
                objectTransform = `translate(${cx}, ${cy}) rotate(${obj.rotation}) skewX(${obj.skewX || 0}) skewY(${obj.skewY || 0}) translate(${-w / 2}, ${-h / 2})`;
                handleTransform = `translate(${cx}, ${cy}) rotate(${obj.rotation})`; 
            }
        } else {
            const bounds = calculateGroupBounds(selectedObjects);
            w = bounds.width;
            h = bounds.height;
            const cx = bounds.x + w / 2;
            const cy = bounds.y + h / 2;
            
            objectTransform = `translate(${cx}, ${cy}) translate(${-w / 2}, ${-h / 2})`;
            handleTransform = `translate(${cx}, ${cy})`;
        }
        
        if (!isSingleSelection || selectedObjects[0].type !== 'measurement') {
            handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];
        }

        const getSkewedHandlePos = (handle: ResizeHandle, objWidth: number, objHeight: number, skewX: number = 0, skewY: number = 0) => {
            let lx = 0;
            let ly = 0;
            if (handle.includes('left')) lx = -paddingVal;
            else if (handle.includes('right')) lx = objWidth + paddingVal;
            else lx = objWidth / 2;

            if (handle.includes('top')) ly = -paddingVal;
            else if (handle.includes('bottom')) ly = objHeight + paddingVal;
            else ly = objHeight / 2;

            const rx = lx - objWidth / 2;
            const ry = ly - objHeight / 2;

            const skXRad = skewX * Math.PI / 180;
            const skYRad = skewY * Math.PI / 180;
            const skewedX = rx + ry * Math.tan(skXRad);
            const skewedY = rx * Math.tan(skYRad) + ry;

            return { x: skewedX, y: skewedY };
        };
        
        const obj = isSingleSelection ? selectedObjects[0] : null;
        const skX = obj?.skewX || 0;
        const skY = obj?.skewY || 0;
        
        const topCenterY = -h / 2 - paddingVal;
        const rotTipY = -h / 2 - rotHandleOffset;
        
        const rotBaseX = 0 + topCenterY * Math.tan(skX * Math.PI / 180);
        const rotBaseY = 0 * Math.tan(skY * Math.PI / 180) + topCenterY;
        
        const rotTipX = 0 + rotTipY * Math.tan(skX * Math.PI / 180);
        const rotTipY_pos = 0 * Math.tan(skY * Math.PI / 180) + rotTipY;

        return (
            <g transform={layerTransform} style={{ pointerEvents: 'none' }}>
                {/* Bounding Box (Skewed) */}
                <g transform={objectTransform}>
                    <rect 
                        x={-paddingVal} 
                        y={-paddingVal} 
                        width={w + paddingVal * 2} 
                        height={h + paddingVal * 2} 
                        fill="none" 
                        stroke="rgb(56, 189, 248)" 
                        strokeWidth={strokeW} 
                    />
                </g>

                {/* Handles & Rotation */}
                <g transform={handleTransform}>
                    <line x1={rotBaseX} y1={rotBaseY} x2={rotTipX} y2={rotTipY_pos} stroke="rgb(56, 189, 248)" strokeWidth={strokeW} />
                    <circle cx={rotTipX} cy={rotTipY_pos} r={handleSize} fill="white" stroke="rgb(56, 189, 248)" strokeWidth={strokeW} style={{ pointerEvents: 'auto' }} />
                    
                    {handles.map(handle => {
                        const pos = getSkewedHandlePos(handle, w, h, skX, skY);
                        return (
                            <rect 
                                key={handle} 
                                x={pos.x - handleSize / 2} 
                                y={pos.y - handleSize / 2} 
                                width={handleSize} 
                                height={handleSize} 
                                fill="white" 
                                stroke="rgb(56, 189, 248)" 
                                strokeWidth={strokeW} 
                                style={{ pointerEvents: 'auto' }} 
                            />
                        );
                    })}
                </g>
            </g>
        );
    }, [selectedObjects, interaction.mode, editingMode, layers, activeLayerId, zoom, width, height, activeTool]);
};
