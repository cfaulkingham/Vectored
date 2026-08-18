import React from 'react';
import type { Layer, PrimitivePatternData, TextObject, VectorObject } from '../../types';
import { getSVGPathFromObject } from '../../lib/geometry';

interface PatternPreviewProps {
    patternPreviewData: PrimitivePatternData | null;
    activeLayer: Layer | undefined;
    patternPreviewObjects: VectorObject[];
    width: number;
    height: number;
}

export const PatternPreview: React.FC<PatternPreviewProps> = ({
    patternPreviewData,
    activeLayer,
    patternPreviewObjects,
    width,
    height,
}) => {
    if (!patternPreviewData || !activeLayer || patternPreviewObjects.length === 0) return null;

    const obj = patternPreviewObjects[0];
    const clipId = `preview-clip-${obj.id}`;
    
    const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayer;
    const pivotX = width / 2;
    const pivotY = height / 2;
    const layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;
    
    const previewColor = '#000000';
    let content: React.ReactNode = null;

    if (patternPreviewData.type === 'circles' || patternPreviewData.type === 'halftone' || patternPreviewData.type === 'stipple') {
        const circles = (patternPreviewData as any).circles;
        // Batch circles into compound path for high performance if more than 20 circles
        if (circles.length > 20) {
            const compoundPath = circles
                .map((c: { cx: number; cy: number; r: number }) => 
                    `M ${c.cx - c.r} ${c.cy} a ${c.r} ${c.r} 0 1 0 ${c.r * 2} 0 a ${c.r} ${c.r} 0 1 0 ${-c.r * 2} 0`
                )
                .join(' ');
            content = <path d={compoundPath} fill={previewColor} />;
        } else {
            content = (
                <g>
                    {circles.map((c: any, i: number) => (
                        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={previewColor} />
                    ))}
                </g>
            );
        }
    } else if (patternPreviewData.type === 'words') {
        const words = (patternPreviewData as any).words;
        content = (
            <g>
                {words.map((w: any, i: number) => (
                    <text 
                        key={i} 
                        x={w.x} 
                        y={w.y} 
                        fontSize={w.fontSize} 
                        fontFamily={w.fontFamily} 
                        fontWeight={w.fontWeight}
                        transform={`rotate(${w.rotation}, ${w.x}, ${w.y})`}
                        fill={previewColor} 
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {w.text}
                    </text>
                ))}
            </g>
        );
    } else {
        // Path based patterns: batch if many paths
        const paths = (patternPreviewData as any).paths;
        if (paths && paths.length > 20) {
            const combinedD = paths.join(' ');
            content = <path d={combinedD} fill="none" stroke={previewColor} strokeWidth="1" />;
        } else if (paths) {
            content = (
                <g>
                    {paths.map((d: string, i: number) => (
                        <path key={i} d={d} fill="none" stroke={previewColor} strokeWidth="1" />
                    ))}
                </g>
            );
        }
    }

    let clipElement: React.ReactNode = null;
    if (obj.type === 'text') {
        const tObj = obj as TextObject;
        const cx = tObj.x + tObj.width / 2;
        const cy = tObj.y + tObj.height / 2;
        const tTransform = `translate(${cx}, ${cy}) rotate(${tObj.rotation}) skewX(${tObj.skewX || 0}) skewY(${tObj.skewY || 0}) translate(${-cx}, ${-cy})`;
        const lines = tObj.text.split('\n');
        clipElement = (
            <text x={tObj.x} y={tObj.y} fontSize={tObj.fontSize} fontFamily={tObj.fontFamily} fontWeight={tObj.fontWeight} transform={tTransform} dominantBaseline="hanging">
                {lines.map((line, index) => (
                    <tspan key={index} x={tObj.x} dy={index === 0 ? 0 : '1.2em'}>{line || ' '}</tspan>
                ))}
            </text>
        );
    } else {
        const d = getSVGPathFromObject(obj);
        if (d) clipElement = <path d={d} />;
    }

    return (
        <g transform={layerTransform} style={{ pointerEvents: 'none' }}>
            <defs>
                <clipPath id={clipId}>{clipElement}</clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
                {content}
            </g>
        </g>
    );
};
