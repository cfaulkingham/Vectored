import React, { useMemo } from 'react';
import type { ActiveGuide, Layer, MirrorMode, PolygonVertex, RenderableElement } from '../../types';
import { getPolygonPathWithCurves } from '../../lib/geometry';

interface StaticAndSnapGuidesProps {
    editingMode: 'shape' | 'clip' | 'layer';
    isLayerClipPolygonClosed: boolean;
    activeLayerClipPolygonPoints: PolygonVertex[];
    activeLayer: Layer | undefined;
    mirrorMode: MirrorMode;
    mirrorGap: number;
    zoom: number;
    width: number;
    height: number;
    activeGuides: ActiveGuide[];
    layers: { layer: Layer; elements: RenderableElement[] }[];
    activeLayerId: string | null;
}

export const StaticAndSnapGuides: React.FC<StaticAndSnapGuidesProps> = ({
    editingMode,
    isLayerClipPolygonClosed,
    activeLayerClipPolygonPoints,
    activeLayer,
    mirrorMode,
    mirrorGap,
    zoom,
    width,
    height,
    activeGuides,
    layers,
    activeLayerId,
}) => {
    const staticGuides = useMemo(() => {
        const strokeW = 1 / zoom;
        const halfGap = mirrorGap / 2;
        return (
            <g>
                {editingMode === 'shape' && isLayerClipPolygonClosed && activeLayer && (
                    <g transform={`translate(${activeLayer.offsetX || 0}, ${activeLayer.offsetY || 0})`}>
                        <path d={getPolygonPathWithCurves(activeLayerClipPolygonPoints, true)} fill="none" stroke="rgba(192, 132, 252, 0.4)" strokeWidth="1" strokeDasharray="4 4" />
                    </g>
                )}
                {mirrorMode === 'horizontal' && (
                    <>
                        <line x1={width / 2 - halfGap} y1={0} x2={width / 2 - halfGap} y2={height} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4 * strokeW} ${4 * strokeW}`} />
                        <line x1={width / 2 + halfGap} y1={0} x2={width / 2 + halfGap} y2={height} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4 * strokeW} ${4 * strokeW}`} />
                    </>
                )}
                {mirrorMode === 'vertical' && (
                    <>
                        <line x1={0} y1={height / 2 - halfGap} x2={width} y2={height / 2 - halfGap} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4 * strokeW} ${4 * strokeW}`} />
                        <line x1={0} y1={height / 2 + halfGap} x2={width} y2={height / 2 + halfGap} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4 * strokeW} ${4 * strokeW}`} />
                    </>
                )}
            </g>
        );
    }, [editingMode, isLayerClipPolygonClosed, activeLayerClipPolygonPoints, activeLayer, mirrorMode, mirrorGap, zoom, width, height]);

    const activeSnapGuides = useMemo(() => {
        if (activeGuides.length === 0) return null;
        const strokeW = 1 / zoom;
        const activeLayerForGuides = layers.find(l => l.layer.id === activeLayerId)?.layer;
        let layerTransform = '';
        
        if (activeLayerForGuides) {
            const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayerForGuides;
            const pivotX = width / 2;
            const pivotY = height / 2;
            layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;
        }

        return (
            <g transform={layerTransform} style={{ pointerEvents: 'none' }}>
                {activeGuides.map((guide, i) => (
                    <line 
                        key={i}
                        x1={guide.type === 'vertical' ? guide.position : guide.start}
                        y1={guide.type === 'horizontal' ? guide.position : guide.start}
                        x2={guide.type === 'vertical' ? guide.position : guide.end}
                        y2={guide.type === 'horizontal' ? guide.position : guide.end}
                        stroke="#F472B6"
                        strokeWidth={strokeW * 1.5}
                    />
                ))}
            </g>
        );
    }, [activeGuides, zoom, layers, activeLayerId, width, height]);

    return (
        <>
            {staticGuides}
            {activeSnapGuides}
        </>
    );
};
