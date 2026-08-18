import React, { useMemo } from 'react';
import type { InteractionState, MirrorMode, VectorObject, MeasurementObject, PathObject } from '../../types';
import { getShapePath, getSmoothedPolylinePath, getPolygonPathWithCurves, applyMirrorToObject } from '../../lib/geometry';

interface DrawingPreviewProps {
    interaction: InteractionState;
    mirrorMode: MirrorMode;
    mirrorGap: number;
    width: number;
    height: number;
    dpi: number;
    units: string;
}

export const DrawingPreview: React.FC<DrawingPreviewProps> = ({
    interaction,
    mirrorMode,
    mirrorGap,
    width,
    height,
    dpi,
    units,
}) => {
    return useMemo(() => {
        const renderMeasurementPreview = (obj: MeasurementObject) => {
            const { x1, y1, x2, y2 } = obj;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return null;

            const originalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

            let ndx_display = dx;
            let ndy_display = dy;
            if (ndx_display < 0 || (ndx_display === 0 && ndy_display < 0)) {
                ndx_display = -ndx_display;
                ndy_display = -ndy_display;
            }
            const displayAngleDeg = Math.atan2(ndy_display, ndx_display) * 180 / Math.PI;

            const lengthVal = units === 'mm' ? (len * 25.4) / dpi : (units === 'in' ? len / dpi : len);
            const text = `${lengthVal.toFixed(2)} ${units}  ${displayAngleDeg.toFixed(1)}°`;

            const px = -dy / len;
            const py = dx / len;
            const tickSize = 5;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            let textRot = originalAngleDeg;
            if (textRot > 90) textRot -= 180;
            if (textRot < -90) textRot -= 180;
            const textOffset = (obj.strokeWidth || 1) + 10;

            return (
                <g>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />
                    <line x1={x1 - px * tickSize} y1={y1 - py * tickSize} x2={x1 + px * tickSize} y2={y1 + py * tickSize} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />
                    <line x1={x2 - px * tickSize} y1={y2 - py * tickSize} x2={x2 + px * tickSize} y2={y2 + py * tickSize} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />
                    <text
                        x={midX}
                        y={midY}
                        fill={obj.textColor || obj.stroke}
                        fontSize={obj.fontSize || 12}
                        fontFamily={obj.fontFamily || 'monospace'}
                        textAnchor="middle"
                        transform={`rotate(${textRot}, ${midX}, ${midY}) translate(0, -${textOffset})`}
                        style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.8)', strokeWidth: '2px', fill: 'white', pointerEvents: 'none' }}
                    >
                        {text}
                    </text>
                </g>
            );
        };

        const renderPreviewObject = (obj: VectorObject) => {
            let d = '';
            if (obj.type === 'shape') {
                d = getShapePath(obj.shapeType, obj.width, obj.height);
            } else if (obj.type === 'line') {
                d = `M ${obj.x1} ${obj.y1} L ${obj.x2} ${obj.y2}`;
            } else if (obj.type === 'path') {
                d = getSmoothedPolylinePath(obj.points, obj.smoothing) || '';
            } else if (obj.type === 'polygon') {
                d = getPolygonPathWithCurves(obj.points, obj.isClosed);
            }
            
            let transform = '';
            if (obj.type === 'shape') {
               transform = `translate(${obj.x}, ${obj.y})`;
            }

            return (
                <g transform={transform}>
                    <path 
                        d={d} 
                        fill={obj.fill !== 'none' ? (typeof obj.fill === 'string' ? obj.fill : 'url(#grad)') : 'none'} 
                        stroke={obj.stroke !== 'none' ? obj.stroke : 'none'}
                        strokeWidth={obj.strokeWidth}
                        opacity={0.6}
                    />
                    <path d={d} fill="none" stroke="rgb(56, 189, 248)" strokeWidth="1" strokeDasharray="4 4" />
                </g>
            );
        };

        if (interaction.mode === 'marquee_selection') {
            const { startPoint, currentPoint } = interaction;
            const x = Math.min(startPoint[0], currentPoint[0]);
            const y = Math.min(startPoint[1], currentPoint[1]);
            const w = Math.abs(startPoint[0] - currentPoint[0]);
            const h = Math.abs(startPoint[1] - currentPoint[1]);
            return (
                <rect 
                    x={x} y={y} width={w} height={h} 
                    fill="rgba(56, 189, 248, 0.1)" 
                    stroke="rgba(56, 189, 248, 0.8)" 
                    strokeWidth="1" 
                    strokeDasharray="4 4" 
                    pointerEvents="none" 
                />
            );
        }

        if (interaction.mode === 'drawing_measurement') {
            const { object, mirroredObjectId } = interaction as any;
            return (
                <g pointerEvents="none">
                    {renderMeasurementPreview(object as MeasurementObject)}
                    {mirroredObjectId && mirrorMode !== 'off' && (
                        renderMeasurementPreview(applyMirrorToObject(object, mirrorMode, mirrorGap, width, height) as MeasurementObject)
                    )}
                </g>
            );
        }
        
        if (['drawing_object', 'drawing_line', 'drawing_path', 'drawing_polygon'].includes(interaction.mode)) {
            const { object, mirroredObjectId } = interaction as any;
            return (
                <g pointerEvents="none">
                    {renderPreviewObject(object)}
                    {mirroredObjectId && mirrorMode !== 'off' && (
                        renderPreviewObject(applyMirrorToObject(object, mirrorMode, mirrorGap, width, height))
                    )}
                </g>
            );
        }

        if (interaction.mode === 'drawing_pattern_brush') {
             const points = interaction.points;
             if (points.length < 2) return null;
             const d = getSmoothedPolylinePath(points, 0);
             if (!d) return null;
             
             return (
                 <g pointerEvents="none">
                     <path d={d} fill="none" stroke="rgb(56, 189, 248)" strokeWidth="2" opacity="0.6" />
                     {interaction.mirroredStrokeId && mirrorMode !== 'off' && (
                         (() => {
                             const tempObj = { type: 'path', points } as any;
                             const mirrored = applyMirrorToObject(tempObj, mirrorMode, mirrorGap, width, height) as PathObject;
                             const dMirrored = getSmoothedPolylinePath(mirrored.points, 0);
                             return dMirrored ? <path d={dMirrored} fill="none" stroke="rgb(56, 189, 248)" strokeWidth="2" opacity="0.6" /> : null;
                         })()
                     )}
                 </g>
             );
        }

        return null;
    }, [interaction, mirrorMode, mirrorGap, width, height, dpi, units]);
};
