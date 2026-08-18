import React, { useMemo } from 'react';
import type { Units } from '../../types';

interface RulerProps {
    orientation: 'horizontal' | 'vertical';
    size: number;
    breadth: number;
    units: Units;
    dpi: number;
    zoom: number;
    panOffset: number;
    mousePos: number | null;
    draggedGuidePos: number | null;
}

/**
 * Individual Ruler component for horizontal or vertical axes.
 */
export const Ruler: React.FC<RulerProps> = ({
    orientation,
    size,
    breadth,
    units,
    dpi,
    zoom,
    panOffset,
    mousePos,
    draggedGuidePos,
}) => {
    const ticks = useMemo(() => {
        const tickElements: React.ReactElement[] = [];
        const pxPerDisplayUnit = units === 'mm' ? dpi / 25.4 : (units === 'in' ? dpi : 1);
        
        let majorTickIntervalInDisplayUnits = units === 'mm' ? 10 : (units === 'in' ? 1 : 100);
        let subdivisions = 10;

        let majorTickIntervalOnScreen = majorTickIntervalInDisplayUnits * pxPerDisplayUnit * zoom;

        const minTickSpacing = 40;
        const maxTickSpacing = 120;
        const factors = (units === 'mm' || units === 'px') ? [5, 2] : [2, 2.5, 2];
        let factorIndex = 0;

        while (majorTickIntervalOnScreen < minTickSpacing) {
            majorTickIntervalInDisplayUnits *= factors[factorIndex % factors.length];
            majorTickIntervalOnScreen *= factors[factorIndex % factors.length];
            factorIndex++;
        }
        while (majorTickIntervalOnScreen > maxTickSpacing) {
            majorTickIntervalInDisplayUnits /= factors[factorIndex % factors.length];
            majorTickIntervalOnScreen /= factors[factorIndex % factors.length];
            factorIndex++;
        }

        if (units === 'mm') {
            if (majorTickIntervalInDisplayUnits < 1) subdivisions = 0;
            else if (majorTickIntervalInDisplayUnits <= 5) subdivisions = 5;
            else subdivisions = 10;
        } else if (units === 'in') {
            if (majorTickIntervalInDisplayUnits < 0.25) subdivisions = 0;
            else if (majorTickIntervalInDisplayUnits < 1) subdivisions = (1 / majorTickIntervalInDisplayUnits) / 2;
            else subdivisions = 8;
        } else {
            if (majorTickIntervalInDisplayUnits < 10) subdivisions = Math.max(1, majorTickIntervalInDisplayUnits);
            else if (majorTickIntervalInDisplayUnits <= 50) subdivisions = 5;
            else subdivisions = 10;
        }

        const startWorldPx = -panOffset / zoom;
        const endWorldPx = (size - panOffset) / zoom;
        const worldUnitPx = majorTickIntervalInDisplayUnits * pxPerDisplayUnit;
        
        const startTickUnit = Math.floor(startWorldPx / worldUnitPx);
        const endTickUnit = Math.ceil(endWorldPx / worldUnitPx);

        for (let i = startTickUnit; i <= endTickUnit; i++) {
            const currentWorldPx = i * worldUnitPx;
            const screenPos = currentWorldPx * zoom + panOffset;
            
            // Subdivisions
            if (subdivisions > 1) {
                const subStepInWorldPx = worldUnitPx / subdivisions;
                for (let j = 1; j < subdivisions; j++) {
                    const subValue = currentWorldPx + (subStepInWorldPx * j);
                    if (subValue > endWorldPx) break;
                    
                    const subScreenPos = subValue * zoom + panOffset;
                    if (subScreenPos < 0 || subScreenPos > size) continue;

                    const isHalfTick = subdivisions % 2 === 0 && j === subdivisions / 2;
                    const tickLength = isHalfTick ? 7 : 5;
                    
                    if (orientation === 'horizontal') {
                        tickElements.push(
                            <line 
                                key={`t-${subValue}`} 
                                x1={subScreenPos} 
                                y1={breadth} 
                                x2={subScreenPos} 
                                y2={breadth - tickLength} 
                                stroke="rgba(255,255,255,0.3)" 
                            />
                        );
                    } else {
                        tickElements.push(
                            <line 
                                key={`t-${subValue}`} 
                                x1={breadth} 
                                y1={subScreenPos} 
                                x2={breadth - tickLength} 
                                y2={subScreenPos} 
                                stroke="rgba(255,255,255,0.3)" 
                            />
                        );
                    }
                }
            }
            
            if (screenPos < 0 || screenPos > size) continue;

            // Major tick
            const labelValue = currentWorldPx / pxPerDisplayUnit;
            if (orientation === 'horizontal') {
                tickElements.push(
                    <line 
                        key={`l-${currentWorldPx}`} 
                        x1={screenPos} 
                        y1={breadth} 
                        x2={screenPos} 
                        y2={breadth - 10} 
                        stroke="rgba(255,255,255,0.5)" 
                    />
                );
                tickElements.push(
                    <text 
                        key={`tx-${currentWorldPx}`} 
                        x={screenPos + 3} 
                        y={breadth - 14} 
                        fontSize="10" 
                        fill="rgba(255,255,255,0.5)"
                    >
                        {labelValue.toFixed(majorTickIntervalInDisplayUnits < 1 ? 2 : 0)}
                    </text>
                );
            } else {
                tickElements.push(
                    <line 
                        key={`l-${currentWorldPx}`} 
                        x1={breadth} 
                        y1={screenPos} 
                        x2={breadth - 10} 
                        y2={screenPos} 
                        stroke="rgba(255,255,255,0.5)" 
                    />
                );
                tickElements.push(
                    <text 
                        key={`tx-${currentWorldPx}`} 
                        x={breadth - 14} 
                        y={screenPos + 3} 
                        dominantBaseline="hanging" 
                        textAnchor="end" 
                        fontSize="10" 
                        fill="rgba(255,255,255,0.5)"
                    >
                        {labelValue.toFixed(majorTickIntervalInDisplayUnits < 1 ? 2 : 0)}
                    </text>
                );
            }
        }

        return tickElements;
    }, [size, breadth, units, dpi, zoom, panOffset, orientation]);

    // Mouse & guide position indicator
    const indicator = useMemo(() => {
        const indicators: React.ReactElement[] = [];
        if (mousePos !== null && (mousePos >= 0 && mousePos <= size)) {
            if (orientation === 'horizontal') {
                indicators.push(<line key="mouse" x1={mousePos} y1={0} x2={mousePos} y2={breadth} stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />);
            } else {
                indicators.push(<line key="mouse" x1={0} y1={mousePos} x2={breadth} y2={mousePos} stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />);
            }
        }
        if (draggedGuidePos !== null) {
            const screenPos = draggedGuidePos * zoom + panOffset;
            if (screenPos >= 0 && screenPos <= size) {
                if (orientation === 'horizontal') {
                    indicators.push(<line key="guide" x1={screenPos} y1={0} x2={screenPos} y2={breadth} stroke="#06b6d4" strokeWidth="1" />);
                } else {
                    indicators.push(<line key="guide" x1={0} y1={screenPos} x2={breadth} y2={screenPos} stroke="#06b6d4" strokeWidth="1" />);
                }
            }
        }
        return indicators;
    }, [mousePos, draggedGuidePos, size, breadth, orientation, zoom, panOffset]);

    return <g>{ticks}{indicator}</g>;
};

interface CanvasRulersOverlayProps {
    viewportWidth: number;
    viewportHeight: number;
    rulerBreadth: number;
    units: Units;
    dpi: number;
    zoom: number;
    pan: { x: number; y: number };
    mouseScreenPos: [number, number] | null;
    draggedGuidePos: number | null;
    draggedGuideOrientation: 'horizontal' | 'vertical' | null;
}

/**
 * Top and left viewport rulers wrapper.
 */
export const CanvasRulersOverlay: React.FC<CanvasRulersOverlayProps> = ({
    viewportWidth,
    viewportHeight,
    rulerBreadth,
    units,
    dpi,
    zoom,
    pan,
    mouseScreenPos,
    draggedGuidePos,
    draggedGuideOrientation,
}) => {
    return (
        <>
            <div className="absolute top-0 left-0 w-full h-[30px] overflow-hidden pointer-events-none">
                <svg width={viewportWidth} height={rulerBreadth} className="bg-slate-950 border-b border-slate-800">
                    <Ruler
                        orientation="horizontal"
                        size={viewportWidth}
                        breadth={rulerBreadth}
                        units={units}
                        dpi={dpi}
                        zoom={zoom}
                        panOffset={pan.x + rulerBreadth}
                        mousePos={mouseScreenPos ? mouseScreenPos[0] + rulerBreadth : null}
                        draggedGuidePos={draggedGuideOrientation === 'vertical' ? draggedGuidePos : null}
                    />
                </svg>
            </div>
            <div className="absolute top-0 left-0 w-[30px] h-full overflow-hidden pointer-events-none">
                <svg width={rulerBreadth} height={viewportHeight} className="bg-slate-950 border-r border-slate-800">
                    <Ruler
                        orientation="vertical"
                        size={viewportHeight}
                        breadth={rulerBreadth}
                        units={units}
                        dpi={dpi}
                        zoom={zoom}
                        panOffset={pan.y + rulerBreadth}
                        mousePos={mouseScreenPos ? mouseScreenPos[1] + rulerBreadth : null}
                        draggedGuidePos={draggedGuideOrientation === 'horizontal' ? draggedGuidePos : null}
                    />
                </svg>
            </div>
            <div className="absolute top-0 left-0 w-[30px] h-[30px] bg-slate-950 z-10 border-r border-b border-slate-800 flex items-center justify-center text-xs text-slate-100 uppercase font-mono select-none">
                {units}
            </div>
        </>
    );
};
