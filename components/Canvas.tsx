

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import type { Point, PolygonVertex, HoverInfo, InteractionState, RenderableElement, Layer, Units, VectorObject, ResizeHandle, PolygonObject, PathObject, LineObject, ShapeObject, MirrorMode, TextObject, PrimitivePatternData, GenericPathObject, PathGroupObject, ImageObject, ActiveGuide, MeasurementObject, BlendMode, Guide } from '../types';
import { add, sub, scale, rotatePoint, distSq, distToSegmentSq, getPolygonPathWithCurves, getShapePath, calculateGroupBounds, getSmoothedPolylinePath, applyMirrorToObject, calculateGenericPathBounds, getSVGPathFromObject, getPathTotalLength, getPointAndTangentAtLength, getObjectVisualBounds, getObjectHandlePosition, getObjectAsPolygon, transformLayerLocalPointToWorld, transformWorldPointToLayerLocal, getTransformMatrix, transformPoint } from '../lib/geometry';
import { measureText } from '../lib/text-utils';
import { useEditor } from '../context/EditorContext'; // Import context to get activeGuides

declare const d3: any;
// control points now resize with canvas.
interface CanvasProps {
    width: number; 
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    onCanvasMouseDown: (point: Point, hitInfo: HoverInfo | null, altKey: boolean, shiftKey: boolean) => void;
    onRulerMouseDown: (orientation: 'horizontal' | 'vertical', point: Point) => void;
    onCanvasMouseMove: (point: Point | null, shiftKey: boolean) => void;
    onCanvasMouseUp: () => void;
    onCanvasDoubleClick: (hitInfo: HoverInfo | null) => void;
    onUpdateTextContent: (text: string) => void;
    onFinishTextEditing: () => void;
    rulerBreadth: number;
    guides: Guide[];
    renderData: { defs: React.ReactElement[]; layers: { layer: Layer; elements: RenderableElement[] }[] };
    interaction: InteractionState;
    editingMode: 'shape' | 'clip' | 'layer';
    activeLayerClipPolygonPoints: PolygonVertex[];
    isLayerClipPolygonClosed: boolean;
    activeLayerId: string | null;
    units: Units;
    dpi: number;
    selectedObjects: VectorObject[];
    activeTool: string;
    viewState: { zoom: number, pan: { x: number, y: number } };
    setViewState: React.Dispatch<React.SetStateAction<{ zoom: number, pan: { x: number; y: number } }>>;
    mirrorMode: MirrorMode;
    mirrorGap: number;
    patternPreviewData: PrimitivePatternData | null;
    patternPreviewObjects: VectorObject[];
    children?: React.ReactNode;
}
const HANDLE_SIZE = 4;
const ANCHOR_SIZE = 5;
const HIT_THRESHOLD_SQ = 100; // 10px squared

/**
 * A simple inline text editor overlay for editing text objects directly on the canvas.
 */
const InlineTextEditor: React.FC<{
    object: TextObject;
    viewState: { zoom: number; pan: { x: number; y: number } };
    rulerBreadth: number;
    onUpdate: (text: string) => void;
    onFinish: () => void;
}> = ({ object, viewState, rulerBreadth, onUpdate, onFinish }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [object.id]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

    const { x, y, width, height, rotation, fontSize, fontFamily, fontWeight, fill, stroke, strokeWidth, text, textPathId } = object;
    const { zoom, pan } = viewState;
    
    // Transform world coordinates to screen coordinates
    const screenX = x * zoom + pan.x + rulerBreadth;
    const screenY = y * zoom + pan.y + rulerBreadth;
    const screenWidth = width * zoom;
    const screenHeight = height * zoom;

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenWidth + 2}px`, // Add a little padding for cursor
        height: `${screenHeight}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: `${(screenWidth) / 2}px ${(screenHeight) / 2}px`,
        fontFamily,
        fontSize: `${fontSize * zoom}px`,
        fontWeight,
        color: typeof fill === 'string' ? fill : '#ffffff', // Fallback for gradients
        padding: 0,
        margin: 0,
        border: '1px dashed #38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: 1.2,
        whiteSpace: 'pre',
        WebkitTextStroke: `${(strokeWidth || 0) * zoom}px ${stroke}`,
        paintOrder: 'stroke',
    };

    return (
        <textarea
            ref={textareaRef}
            style={style}
            value={text}
            onChange={handleInput}
            onBlur={onFinish}
            onKeyDown={handleKeyDown}
            spellCheck={false}
        />
    );
};

/**
 * Rulers component for the canvas.
 * Renders horizontal or vertical rulers based on the provided orientation.
 */
const Ruler: React.FC<{
    orientation: 'horizontal' | 'vertical';
    size: number; // Viewport size
    breadth: number;
    units: Units;
    dpi: number;
    zoom: number;
    panOffset: number; // pan.x or pan.y
    mousePos: number | null; // Screen coordinate of mouse (relative to ruler start)
    draggedGuidePos: number | null; // World coordinate of a guide being dragged
}> = ({ orientation, size, breadth, units, dpi, zoom, panOffset, mousePos, draggedGuidePos }) => {
    const ticks = useMemo(() => {
        const tickElements = [];
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
            else if (majorTickIntervalInDisplayUnits < 1) subdivisions = (1/majorTickIntervalInDisplayUnits)/2;
            else subdivisions = 8;
        } else { // pixels
            if (majorTickIntervalInDisplayUnits < 10) subdivisions = Math.max(1, majorTickIntervalInDisplayUnits);
            else if (majorTickIntervalInDisplayUnits <= 50) subdivisions = 5;
            else subdivisions = 10;
        }

        // Calculate the range of world coordinates visible
        // screenX = worldX * zoom + panOffset
        // worldX = (screenX - panOffset) / zoom
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
                        tickElements.push(<line key={`t-${subValue}`} x1={subScreenPos} y1={breadth} x2={subScreenPos} y2={breadth - tickLength} stroke="rgba(255,255,255,0.3)" />);
                    } else {
                        tickElements.push(<line key={`t-${subValue}`} x1={breadth} y1={subScreenPos} x2={breadth - tickLength} y2={subScreenPos} stroke="rgba(255,255,255,0.3)" />);
                    }
                }
            }
            
            if (screenPos < 0 || screenPos > size) continue;

            // Major tick
            const labelValue = currentWorldPx / pxPerDisplayUnit;
            if (orientation === 'horizontal') {
                tickElements.push(<line key={`l-${currentWorldPx}`} x1={screenPos} y1={breadth} x2={screenPos} y2={breadth - 10} stroke="rgba(255,255,255,0.5)" />);
                tickElements.push(<text key={`tx-${currentWorldPx}`} x={screenPos + 3} y={breadth - 14} fontSize="10" fill="rgba(255,255,255,0.5)">{labelValue.toFixed(majorTickIntervalInDisplayUnits < 1 ? 2 : 0)}</text>);
            } else {
                tickElements.push(<line key={`l-${currentWorldPx}`} x1={breadth} y1={screenPos} x2={breadth - 10} y2={screenPos} stroke="rgba(255,255,255,0.5)" />);
                tickElements.push(<text key={`tx-${currentWorldPx}`} x={breadth - 14} y={screenPos + 3} dominantBaseline="hanging" textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">{labelValue.toFixed(majorTickIntervalInDisplayUnits < 1 ? 2 : 0)}</text>);
            }
        }

        return tickElements;
    }, [size, breadth, units, dpi, zoom, panOffset, orientation]);

    // Mouse position indicator
    const indicator = useMemo(() => {
        let indicators = [];
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

/**
 * The main interactive canvas component.
 * Handles rendering of vector objects, user interactions (mouse/keyboard),
 * zoom/pan, rulers, and overlay controls (handles, selection boxes).
 */
const Canvas: React.FC<CanvasProps> = (props) => {
    const {
        width, height, // Document dimensions
        viewportWidth, viewportHeight, // Available screen space
        onCanvasMouseDown, onRulerMouseDown, onCanvasMouseMove, onCanvasMouseUp, onCanvasDoubleClick, onUpdateTextContent, onFinishTextEditing, rulerBreadth,
        guides,
        renderData,
        interaction, editingMode,
        activeLayerClipPolygonPoints, isLayerClipPolygonClosed,
        activeLayerId,
        units, dpi,
        selectedObjects, activeTool,
        viewState, setViewState,
        mirrorMode, mirrorGap,
        patternPreviewData,
        patternPreviewObjects,
        children,
    } = props;
    const svgRef = useRef<SVGSVGElement>(null);
    // Get activeGuides from context
    const { activeGuides } = useEditor();

    // mouseWorldPos: Point in document coordinates
    const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
    // mouseScreenPos: Point in screen coordinates (relative to rulers)
    const [mouseScreenPos, setMouseScreenPos] = useState<Point | null>(null);
    
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanningState, setIsPanningState] = useState(false);
    const isPanning = useRef(false);
    const panStart = useRef({ screenX: 0, screenY: 0, panX: 0, panY: 0 });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift' && !e.repeat) setIsShiftPressed(true);
            if (e.key === ' ' && !e.repeat) setIsSpacePressed(true);
            if (e.key === 'Alt' && !e.repeat) {
                e.preventDefault();
                setIsAltPressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftPressed(false);
            if (e.key === ' ') setIsSpacePressed(false);
            if (e.key === 'Alt') setIsAltPressed(false);
        };
        const handleBlur = () => {
            setIsShiftPressed(false);
            setIsSpacePressed(false);
            setIsAltPressed(false);
            onCanvasMouseUp();
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [onCanvasMouseUp]);

    const activeLayer = useMemo(() => {
        return renderData.layers.find(l => l.layer.id === activeLayerId)?.layer;
    }, [renderData.layers, activeLayerId]);

    /**
     * Converts a mouse event to World Coordinates (relative to the Artboard origin).
     * Formula: World = (Screen - Pan) / Zoom
     */
    const getPointFromEvent = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        
        // Screen coordinates relative to the top-left of the Viewport (including rulers)
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasScreenX = mouseX - rulerBreadth;
        const canvasScreenY = mouseY - rulerBreadth;

        const { zoom, pan } = viewState;
        
        const worldX = (canvasScreenX - pan.x) / zoom;
        const worldY = (canvasScreenY - pan.y) / zoom;

        return [worldX, worldY];
    }, [rulerBreadth, viewState]);


    const handleWheel = useCallback((e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
                // Pan Horizontal
                setViewState(prev => ({ ...prev, pan: { ...prev.pan, x: prev.pan.x - e.deltaY } }));
            } else {
                // Pan Vertical
                // Only scroll vertically if the content height is larger than the available viewport height
                const availableHeight = viewportHeight - rulerBreadth;
                const contentHeight = height * viewState.zoom;
                const scrollPadding = 20;
                
                if (contentHeight > availableHeight) {
                    setViewState(prev => {
                        const proposedY = prev.pan.y - e.deltaY;
                        const minPanY = availableHeight - contentHeight - scrollPadding;
                        const maxPanY = scrollPadding;
                        const clampedY = Math.max(minPanY, Math.min(maxPanY, proposedY));
                        return { ...prev, pan: { ...prev.pan, y: clampedY } };
                    });
                }
            }
            return;
        }
        
        e.preventDefault();
    
        const svgElement = svgRef.current;
        if (!svgElement) return;

        const { zoom, pan } = viewState;
        const zoomFactor = 1.1;
        const newZoom = e.deltaY > 0 ? zoom / zoomFactor : zoom * zoomFactor;
        const clampedZoom = Math.max(0.05, Math.min(50, newZoom));
    
        const rect = svgElement.getBoundingClientRect();
        const mouseScreenX = e.clientX - rect.left - rulerBreadth;
        const mouseScreenY = e.clientY - rect.top - rulerBreadth;
        
        // World coordinate before zoom
        const worldX = (mouseScreenX - pan.x) / zoom;
        const worldY = (mouseScreenY - pan.y) / zoom;
    
        // We want worldX, worldY to remain at mouseScreenX, mouseScreenY after zoom
        // mouseScreenX = worldX * newZoom + newPanX
        // newPanX = mouseScreenX - worldX * newZoom
    
        const newPanX = mouseScreenX - worldX * clampedZoom;
        const newPanY = mouseScreenY - worldY * clampedZoom;
    
        setViewState({ zoom: clampedZoom, pan: { x: newPanX, y: newPanY } });
    }, [viewState, setViewState, viewportHeight, rulerBreadth, height]);
    
    useEffect(() => {
        const svgElement = svgRef.current;
        if (!svgElement) return;

        const wheelHandler = (e: WheelEvent) => handleWheel(e);

        svgElement.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            svgElement.removeEventListener('wheel', wheelHandler);
        };
    }, [handleWheel]);


    const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (isSpacePressed || e.button === 1) { // Pan
            isPanning.current = true;
            setIsPanningState(true);
            panStart.current = {
                screenX: e.clientX,
                screenY: e.clientY,
                panX: viewState.pan.x,
                panY: viewState.pan.y
            };
            e.preventDefault();
            return;
        }
        
        const rect = e.currentTarget.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPoint = getPointFromEvent(e);
        
        // PRIORITY 1: Check if we're moving an existing guide.
        // This needs to happen before ruler clicks because guides extend into the ruler area.
        if (hoverInfo?.type === 'guide') {
            onCanvasMouseDown(worldPoint, hoverInfo, e.altKey, e.shiftKey);
            return;
        }

        // Check for ruler clicks (to create new guides)
        if (screenY < rulerBreadth && screenX > rulerBreadth) {
            onRulerMouseDown('horizontal', worldPoint);
            return;
        }
        if (screenX < rulerBreadth && screenY > rulerBreadth) {
            onRulerMouseDown('vertical', worldPoint);
            return;
        }

        // Click on the artboard
        if (screenX > rulerBreadth && screenY > rulerBreadth) {
            onCanvasMouseDown(worldPoint, hoverInfo, e.altKey, e.shiftKey);
        }
    };

    const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (interaction.mode === 'idle') {
            onCanvasDoubleClick(hoverInfo);
        }
    };
    
    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouseScreenPos([e.clientX - rect.left - rulerBreadth, e.clientY - rect.top - rulerBreadth]);

        const worldPoint = getPointFromEvent(e);
        setMouseWorldPos(worldPoint);

        if (isPanning.current) {
            const dx = e.clientX - panStart.current.screenX;
            const dy = e.clientY - panStart.current.screenY;
            
            setViewState({ ...viewState, pan: { x: panStart.current.panX + dx, y: panStart.current.panY + dy } });
            return;
        }

        let foundInfo: HoverInfo | null = null;
        let pointForMove: Point | null = worldPoint;

        if (worldPoint) {
            const effectiveHitThresholdSq = HIT_THRESHOLD_SQ / (viewState.zoom * viewState.zoom);
            
            if (interaction.mode === 'drawing_polygon') {
                const poly = interaction.object as PolygonObject;
                // Need at least start point + one other point to close (total 3 including floating point)
                if (poly.points.length >= 3) {
                    const firstPoint = poly.points[0].anchor;
                    if (distSq(worldPoint, firstPoint) < effectiveHitThresholdSq) {
                        foundInfo = { type: 'close_polygon' };
                        pointForMove = firstPoint; // Snap!
                    }
                }
            } else if (interaction.mode === 'drawing' && editingMode === 'clip') {
                 const points = activeLayerClipPolygonPoints;
                 // activeLayerClipPolygonPoints includes the floating point.
                 // We need at least 3 points (2 fixed + 1 floating) to close a polygon.
                 if (points.length >= 3) {
                    const firstPoint = points[0].anchor;
                    // We transform because points are in layer space, worldPoint is world space.
                    if (activeLayer) {
                        const firstPointWorld = transformLayerLocalPointToWorld(firstPoint, activeLayer, {width, height});
                        
                        if (distSq(worldPoint, firstPointWorld) < effectiveHitThresholdSq) {
                            foundInfo = { type: 'close_polygon' };
                            pointForMove = firstPointWorld;
                        }
                    }
                 }
            }
            else if (interaction.mode === 'idle') {
                const point = worldPoint;
                // Specialized Hit Testing for Measure Tool
                if (activeTool === 'measure') {
                    if (activeLayer) {
                        // Transform world point to layer local for checking against objects
                        const pointForLayer = transformWorldPointToLayerLocal(point, activeLayer, {width, height});

                        for (let i = activeLayer.objects.length - 1; i >= 0; i--) {
                            const obj = activeLayer.objects[i];
                            // Skip if not a suitable type
                            if (obj.type === 'group' || obj.type === 'image') continue;

                            const polyPoints = getObjectAsPolygon(obj);
                            if (polyPoints) {
                                const isClosed = obj.type === 'polygon' ? (obj as PolygonObject).isClosed : 
                                                 obj.type === 'path' ? false : true;
                                
                                const pointsToCheck = isClosed ? [...polyPoints, polyPoints[0]] : polyPoints;
                                
                                for (let j = 0; j < pointsToCheck.length - 1; j++) {
                                    const p1 = pointsToCheck[j];
                                    const p2 = pointsToCheck[j+1];
                                    if (distToSegmentSq(pointForLayer, p1, p2) < effectiveHitThresholdSq) {
                                        // Transform p1, p2 back to world space for the hover info
                                        const p1World = transformLayerLocalPointToWorld(p1, activeLayer, {width, height});
                                        const p2World = transformLayerLocalPointToWorld(p2, activeLayer, {width, height});
                                        foundInfo = { type: 'measure_segment', p1: p1World, p2: p2World, objectId: obj.id };
                                        break;
                                    }
                                }
                            }
                            if (foundInfo) break;
                        }
                    }
                }

                if (!foundInfo) {
                    if (editingMode === 'layer') {
                        if (activeLayer) {
                            const { scale } = activeLayer;
                            const effectiveScale = scale || 1;

                            // Use transformWorldPointToLayerLocal to properly account for skew/rotate/scale
                            const localPoint = transformWorldPointToLayerLocal(point, activeLayer, {width, height});

                            const handles: { name: ResizeHandle, pos: Point }[] = [
                                { name: 'top-left', pos: [0, 0] }, { name: 'top', pos: [width/2, 0] }, { name: 'top-right', pos: [width, 0] },
                                { name: 'left', pos: [0, height/2] }, { name: 'right', pos: [width, height/2] },
                                { name: 'bottom-left', pos: [0, height] }, { name: 'bottom', pos: [width/2, height] }, { name: 'bottom-right', pos: [width, height] },
                            ];
                            
                            const scaledHitThresholdSq = HIT_THRESHOLD_SQ / ((effectiveScale * viewState.zoom) * (effectiveScale * viewState.zoom));
                            
                            for (const handle of handles) {
                                if (distSq(localPoint, handle.pos) < scaledHitThresholdSq) {
                                    foundInfo = { type: 'layer_resize_handle', handle: handle.name };
                                    break;
                                }
                            }
                            if (!foundInfo) {
                                const rotHandlePos: Point = [width / 2, -20 / effectiveScale];
                                if (distSq(localPoint, rotHandlePos) < scaledHitThresholdSq) {
                                    foundInfo = { type: 'layer_rotate_handle' };
                                }
                            }
                        }
                    }
                    else if (editingMode === 'shape') { // Object interaction
                        const activeLayerForHit = renderData.layers.find(l => l.layer.id === activeLayerId)?.layer;
                        
                        let transformedPointForHandles = point;
                        if (activeLayerForHit) {
                            // Use proper inverse transform including skew
                            transformedPointForHandles = transformWorldPointToLayerLocal(point, activeLayerForHit, {width, height});
                        }

                        if (activeTool === 'node' && activeLayerForHit) {
                            // 1. Priority Check: Polygon Vertex/Handle controls for ALL polygons
                            for (let i = activeLayerForHit.objects.length - 1; i >= 0; i--) {
                                const obj = activeLayerForHit.objects[i];
                                // FIX: Property 'isLocked' does not exist on VectorObject. Object-level locking is not implemented.
                                if (obj.type !== 'polygon') continue;
                                
                                const center: Point = [obj.x + obj.width / 2, obj.y + obj.height / 2];
                                const rad = -obj.rotation * Math.PI / 180;
                                const localPoint = rotatePoint(transformedPointForHandles, center, rad);

                                const polyPoints = (obj as PolygonObject).points;
                                for (let k = 0; k < polyPoints.length; k++) {
                                    const vertex = polyPoints[k];
                                    if (distSq(localPoint, vertex.anchor) < effectiveHitThresholdSq) { foundInfo = { type: 'polygon_anchor', layerId: activeLayerForHit.id, objectId: obj.id, vertexIndex: k }; break; }
                                    if (distSq(localPoint, vertex.handle1) < effectiveHitThresholdSq) { foundInfo = { type: 'polygon_handle', layerId: activeLayerForHit.id, objectId: obj.id, vertexIndex: k, handleKey: 'handle1' }; break; }
                                    if (distSq(localPoint, vertex.handle2) < effectiveHitThresholdSq) { foundInfo = { type: 'polygon_handle', layerId: activeLayerForHit.id, objectId: obj.id, vertexIndex: k, handleKey: 'handle2' }; break; }
                                }
                                if(foundInfo) break;

                                // Check segments
                                const pathPoints = (obj as PolygonObject).isClosed ? [...polyPoints, polyPoints[0]] : polyPoints;
                                for (let k = 0; k < pathPoints.length - 1; k++) {
                                    if (distToSegmentSq(localPoint, pathPoints[k].anchor, pathPoints[k+1].anchor) < effectiveHitThresholdSq) {
                                        foundInfo = { type: 'polygon_segment', layerId: activeLayerForHit.id, objectId: obj.id, segmentIndex: k }; break;
                                    }
                                }
                                if(foundInfo) break;
                            }
                        } else if (activeTool === 'select') {
                            // 2. Check Resize/Rotate Handles
                            if (!foundInfo && selectedObjects.length > 0) {
                                if (selectedObjects.length === 1) {
                                    // Single object selection: Use correct matrix math including skew
                                    const obj = selectedObjects[0];
                                    // Apply padding to handle hit detection for polygons to ensure we don't conflict with vertices
                                    const isPolygon = obj.type === 'polygon';
                                    const handlePadding = 0

                                    const handlesList: ResizeHandle[] = [
                                        'top-left', 'top', 'top-right',
                                        'left', 'right',
                                        'bottom-left', 'bottom', 'bottom-right'
                                    ];
                                    
                                    // Calculate padded matrix/bounds for handle hit testing if polygon
                                    const matrix = getTransformMatrix(obj); // Standard object matrix
                                    
                                    for (const handleName of handlesList) {
                                        let handlePos: Point;
                                        if (handlePadding > 0) {
                                            // Manually calculate handle position with padding
                                            let lx = 0, ly = 0;
                                            if (handleName.includes('left')) lx = obj.x - handlePadding;
                                            else if (handleName.includes('right')) lx = obj.x + obj.width + handlePadding;
                                            else lx = obj.x + obj.width / 2;

                                            if (handleName.includes('top')) ly = obj.y - handlePadding;
                                            else if (handleName.includes('bottom')) ly = obj.y + obj.height + handlePadding;
                                            else ly = obj.y + obj.height / 2;
                                            
                                            handlePos = transformPoint([lx, ly], matrix);
                                        } else {
                                            handlePos = getObjectHandlePosition(obj, handleName);
                                        }

                                        if (distSq(transformedPointForHandles, handlePos) < effectiveHitThresholdSq) {
                                            foundInfo = { type: 'resize_handle', layerId: activeLayerId!, objectId: obj.id, handle: handleName };
                                            break;
                                        }
                                    }
                                    
                                    if (!foundInfo) {
                                        // Rotation handle also respects padding
                                        const rotOffsetY = 20 / viewState.zoom + handlePadding;
                                        const rotHandleLocal: Point = [obj.x + obj.width / 2, obj.y - rotOffsetY];
                                        
                                        // Apply skew manually to ensure rotation handle is perpendicular to top edge
                                        const cx = obj.x + obj.width / 2;
                                        const cy = obj.y + obj.height / 2;
                                        const localRotPoint: Point = [rotHandleLocal[0] - cx, rotHandleLocal[1] - cy];
                                        
                                        // Skew transform logic
                                        const skX = (obj.skewX || 0) * Math.PI / 180;
                                        const skY = (obj.skewY || 0) * Math.PI / 180;
                                        const skewedX = localRotPoint[0] + localRotPoint[1] * Math.tan(skX);
                                        const skewedY = localRotPoint[0] * Math.tan(skY) + localRotPoint[1];
                                        
                                        // Rotate
                                        const rot = (obj.rotation || 0) * Math.PI / 180;
                                        const rotatedX = skewedX * Math.cos(rot) - skewedY * Math.sin(rot);
                                        const rotatedY = skewedX * Math.sin(rot) + skewedY * Math.cos(rot);
                                        
                                        // Translate back
                                        const rotPos: Point = [rotatedX + cx, rotatedY + cy];
                                        
                                        if (distSq(transformedPointForHandles, rotPos) < effectiveHitThresholdSq) {
                                            foundInfo = { type: 'rotate_handle', layerId: activeLayerId!, objectId: obj.id };
                                        }
                                    }

                                } else {
                                    // Group Selection (AABB) logic remains the same as it doesn't skew
                                    const bounds = calculateGroupBounds(selectedObjects);
                                    const center: Point = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
                                    
                                    const handles: { name: ResizeHandle, pos: Point }[] = [
                                        { name: 'top-left', pos: [bounds.x, bounds.y] }, { name: 'top', pos: [bounds.x + bounds.width/2, bounds.y] }, { name: 'top-right', pos: [bounds.x + bounds.width, bounds.y] },
                                        { name: 'left', pos: [bounds.x, bounds.y + bounds.height/2] }, { name: 'right', pos: [bounds.x + bounds.width, bounds.y + bounds.height/2] },
                                        { name: 'bottom-left', pos: [bounds.x, bounds.y + bounds.height] }, { name: 'bottom', pos: [bounds.x + bounds.width/2, bounds.y + bounds.height] }, { name: 'bottom-right', pos: [bounds.x + bounds.width, bounds.y + bounds.height] },
                                    ];
                    
                                    for (const handle of handles) {
                                        if (distSq(transformedPointForHandles, handle.pos) < effectiveHitThresholdSq) {
                                            foundInfo = { type: 'resize_handle', layerId: activeLayerId!, objectId: selectedObjects[0].id, handle: handle.name };
                                            break;
                                        }
                                    }
                                    if (!foundInfo) {
                                        const rotHandlePos: Point = [bounds.x + bounds.width/2, bounds.y - (20 / viewState.zoom)];
                                        if (distSq(transformedPointForHandles, rotHandlePos) < effectiveHitThresholdSq) {
                                            foundInfo = { type: 'rotate_handle', layerId: activeLayerId!, objectId: selectedObjects[0].id };
                                        }
                                    }
                                }
                            }

                            // 3. Check General Objects / Unselected Polygons
                            if (!foundInfo) {
                                for (let i = renderData.layers.length - 1; i >= 0; i--) {
                                    const { layer } = renderData.layers[i];
                                    if (layer.isLocked) continue;

                                    let pointForLayer = transformWorldPointToLayerLocal(point, layer, {width, height});

                                    for (let j = layer.objects.length - 1; j >= 0; j--) {
                                        const obj = layer.objects[j];

                                        // General object hover check
                                        const matrix = new DOMMatrix();
                                        const cx = obj.x + obj.width / 2;
                                        const cy = obj.y + obj.height / 2;
                                        matrix.translateSelf(cx, cy);
                                        matrix.rotateSelf(obj.rotation);
                                        if (obj.skewX) matrix.skewXSelf(obj.skewX);
                                        if (obj.skewY) matrix.skewYSelf(obj.skewY);
                                        matrix.translateSelf(-cx, -cy);
                                        
                                        const inverseMatrix = matrix.inverse();
                                        const p = new DOMPoint(pointForLayer[0], pointForLayer[1]).matrixTransform(inverseMatrix);
                                        const localPoint = [p.x, p.y] as Point;
                                        
                                        let isInside = false;
                                        if (obj.type === 'polygon') {
                                            isInside = d3.polygonContains((obj as PolygonObject).points.map(p => p.anchor), localPoint);
                                        } else if (obj.type === 'path') {
                                            isInside = localPoint[0] >= obj.x && localPoint[0] <= obj.x + obj.width && localPoint[1] >= obj.y && localPoint[1] <= obj.y + obj.height;
                                        } else if (obj.type === 'line' || obj.type === 'measurement') {
                                            const l = obj.type === 'line' ? (obj as LineObject) : (obj as MeasurementObject);
                                            if (distToSegmentSq(pointForLayer, [l.x1, l.y1], [l.x2, l.y2]) < effectiveHitThresholdSq) {
                                                isInside = true;
                                            }
                                        } else {
                                            isInside = localPoint[0] >= obj.x && localPoint[0] <= obj.x + obj.width && localPoint[1] >= obj.y && localPoint[1] <= obj.y + obj.height;
                                        }

                                        if (isInside) {
                                            foundInfo = { type: 'object', layerId: layer.id, objectId: obj.id };
                                            break;
                                        }
                                    }
                                    if (foundInfo) break;
                                }
                            }
                        }
                    } else { // Clip path interaction
                        if (activeLayer) {
                            // Use proper inverse transform
                            let localPoint = transformWorldPointToLayerLocal(point, activeLayer, {width, height});

                            // 1. Check for layer handle hover (move handle) - uses world coordinates (point)
                            const { offsetX = 0, offsetY = 0 } = activeLayer;
                            const pivot: Point = [width / 2, height / 2];
                            const handlePos: Point = [ pivot[0] + offsetX, pivot[1] + offsetY ];
                            if (distSq(point, handlePos) < effectiveHitThresholdSq) {
                                foundInfo = { type: 'layer_handle' };
                            }
                            
                            if (!foundInfo) {
                                const points = activeLayerClipPolygonPoints;
                                const isClosed = isLayerClipPolygonClosed;
                                for (let i = 0; i < points.length; i++) {
                                    const vertex = points[i];
                                    if (distSq(localPoint, vertex.anchor) < effectiveHitThresholdSq) { foundInfo = { type: 'anchor', vertexIndex: i }; break; }
                                    if (distSq(localPoint, vertex.handle1) < effectiveHitThresholdSq) { foundInfo = { type: 'handle', vertexIndex: i, handleKey: 'handle1' }; break; }
                                    if (distSq(localPoint, vertex.handle2) < effectiveHitThresholdSq) { foundInfo = { type: 'handle', vertexIndex: i, handleKey: 'handle2' }; break; }
                                }
                                if (!foundInfo) { 
                                    const pathPoints = isClosed ? [...points, points[0]] : points;
                                    for (let i = 0; i < pathPoints.length - 1; i++) {
                                        const p1: Point = pathPoints[i].anchor;
                                        const p2: Point = pathPoints[i+1].anchor;
                                        if (distToSegmentSq(localPoint, p1, p2) < effectiveHitThresholdSq) { foundInfo = { type: 'segment', segmentIndex: i }; break; }
                                    }
                                }
                            }
                        }
                    }
                }

                if (!foundInfo) {
                    const hitThreshold = 10 / viewState.zoom;
                    for (const guide of guides) {
                        if (guide.orientation === 'horizontal') {
                            if (Math.abs(point[1] - guide.position) < hitThreshold) {
                                foundInfo = { type: 'guide', guide };
                                break;
                            }
                        } else { // vertical
                            if (Math.abs(point[0] - guide.position) < hitThreshold) {
                                foundInfo = { type: 'guide', guide };
                                break;
                            }
                        }
                    }
                }
            }
        }
        setHoverInfo(foundInfo);
        if (pointForMove) {
            onCanvasMouseMove(pointForMove, e.shiftKey);
        }
    };

    const handleSvgMouseUp = () => {
        if (isPanning.current) {
            isPanning.current = false;
            setIsPanningState(false);
            return;
        }
        onCanvasMouseUp();
    };

    const handleSvgMouseLeave = () => {
        if (isPanning.current) {
            isPanning.current = false;
            setIsPanningState(false);
        }
        onCanvasMouseUp();
        onCanvasMouseMove(null, false);
        setMouseWorldPos(null);
        setMouseScreenPos(null);
    };
    
    const getCursor = useCallback(() => {
        if (isPanningState) return 'grabbing';
        if (isSpacePressed) return 'grab';
        if (interaction.mode === 'editing_text') return 'text';
        if (interaction.mode === 'moving_clip_path' || interaction.mode === 'moving_object' || interaction.mode === 'moving_layer') return 'grabbing';
        if (interaction.mode === 'moving_polygon_anchor' || interaction.mode === 'moving_anchor') return 'crosshair';
        if (hoverInfo?.type === 'guide' || interaction.mode === 'moving_guide' || interaction.mode === 'dragging_new_guide') {
            const orientation = hoverInfo?.type === 'guide' ? hoverInfo.guide.orientation : (interaction.mode === 'moving_guide' ? interaction.guide.orientation : (interaction as any).orientation);
            return orientation === 'horizontal' ? 'ns-resize' : 'ew-resize';
        }

        // Cursors for Node Tool
        if (activeTool === 'node' && hoverInfo) {
            if (hoverInfo.type === 'polygon_anchor') {
                if (isAltPressed) return 'alias';
                if (isShiftPressed) return 'pointer';
            }
            if (hoverInfo.type === 'polygon_segment') {
                return 'copy';
            }
        }
        
        if (hoverInfo?.type === 'layer_handle' || (hoverInfo?.type === 'object' && activeTool !== 'node') || hoverInfo?.type === 'polygon_anchor' || (editingMode === 'layer' && !hoverInfo)) return 'grab';
        if (hoverInfo?.type === 'rotate_handle' || interaction.mode === 'rotating_object' || interaction.mode === 'rotating_group' || hoverInfo?.type === 'layer_rotate_handle' || interaction.mode === 'rotating_layer') return 'crosshair';
        if (hoverInfo?.type === 'measure_segment') return 'pointer';
        if (hoverInfo?.type === 'close_polygon') return 'pointer';

        if (selectedObjects.length > 0 && (hoverInfo?.type === 'resize_handle' || interaction.mode === 'resizing_object' || interaction.mode === 'resizing_group' || hoverInfo?.type === 'layer_resize_handle' || interaction.mode === 'resizing_layer')) {
            const handle = hoverInfo?.type === 'resize_handle' ? hoverInfo.handle :
                           hoverInfo?.type === 'layer_resize_handle' ? hoverInfo.handle :
                           interaction.mode === 'resizing_object' ? interaction.handle :
                           interaction.mode === 'resizing_group' ? interaction.handle :
                           (interaction.mode === 'resizing_layer' ? interaction.handle : '');
            
            const rotation = (selectedObjects.length === 1) ? selectedObjects[0].rotation : 0;
            const angle = (rotation % 360 + 360) % 360; // Normalize angle to 0-360
            
            const getCursorForAngle = (base: 'ns' | 'ew' | 'nwse' | 'nesw') => {
                const diagonalThreshold = 22.5;
                if (base === 'ns') {
                    if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'ns-resize';
                    if ((angle > 45-diagonalThreshold && angle < 45+diagonalThreshold) || (angle > 225-diagonalThreshold && angle < 225+diagonalThreshold)) return 'nesw-resize';
                    if ((angle > 90-diagonalThreshold && angle < 90+diagonalThreshold) || (angle > 270-diagonalThreshold && angle < 270+diagonalThreshold)) return 'ew-resize';
                    return 'nwse-resize';
                }
                 if (base === 'ew') {
                    if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'ew-resize';
                    if ((angle > 45-diagonalThreshold && angle < 45+diagonalThreshold) || (angle > 225-diagonalThreshold && angle < 225+diagonalThreshold)) return 'nwse-resize';
                    if ((angle > 90-diagonalThreshold && angle < 90+diagonalThreshold) || (angle > 270-diagonalThreshold && angle < 270+diagonalThreshold)) return 'ns-resize';
                    return 'nesw-resize';
                }
                if (base === 'nwse') {
                    if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'nwse-resize';
                    if ((angle > 45-diagonalThreshold && angle < 45+diagonalThreshold) || (angle > 225-diagonalThreshold && angle < 225+diagonalThreshold)) return 'ns-resize';
                    if ((angle > 90-diagonalThreshold && angle < 90+diagonalThreshold) || (angle > 270-diagonalThreshold && angle < 270+diagonalThreshold)) return 'nesw-resize';
                    return 'ew-resize';
                }
                // base === 'nesw'
                if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'nesw-resize';
                if ((angle > 45-diagonalThreshold && angle < 45+diagonalThreshold) || (angle > 225-diagonalThreshold && angle < 225+diagonalThreshold)) return 'ew-resize';
                if ((angle > 90-diagonalThreshold && angle < 90+diagonalThreshold) || (angle > 270-diagonalThreshold && angle < 270+diagonalThreshold)) return 'nwse-resize';
                return 'ns-resize';
            }
            switch (handle) {
                case 'top': case 'bottom': return getCursorForAngle('ns');
                case 'left': case 'right': return getCursorForAngle('ew');
                case 'top-left': case 'bottom-right': return getCursorForAngle('nwse');
                case 'top-right': case 'bottom-left': return getCursorForAngle('nesw');
            }
        }
        
        if (editingMode === 'clip') {
            if (interaction.mode !== 'idle' && interaction.mode !== 'drawing') return 'grabbing';
            if (isShiftPressed && hoverInfo?.type === 'anchor') return 'not-allowed';
            if (hoverInfo?.type === 'anchor' || hoverInfo?.type === 'handle') return 'grab';
            if (hoverInfo?.type === 'segment') return 'pointer';
            if (interaction.mode === 'drawing') return 'crosshair';
        }
        
        if (hoverInfo?.type === 'polygon_handle') {
             return 'grab';
        }
        if (hoverInfo?.type === 'polygon_segment') {
             return 'pointer';
        }

        if (activeTool === 'select') return 'default';
        
        return 'crosshair';
    }, [interaction, hoverInfo, editingMode, isShiftPressed, isAltPressed, activeTool, selectedObjects, isSpacePressed, isPanningState]);

    // Renders the current drawing interaction (e.g. drawing shape, path, line)
    const drawingPreview = useMemo(() => {
        const renderMeasurementPreview = (obj: MeasurementObject) => {
            const { x1, y1, x2, y2 } = obj;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len === 0) return null;

            const originalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

            // Calculate angle for text display (normalized)
            let ndx_display = dx;
            let ndy_display = dy;
            if (ndx_display < 0 || (ndx_display === 0 && ndy_display < 0)) {
                ndx_display = -ndx_display;
                ndy_display = -ndy_display;
            }
            const displayAngleDeg = Math.atan2(ndy_display, ndx_display) * 180 / Math.PI;

            // Unit conversion
            const lengthVal = units === 'mm' ? (len * 25.4) / dpi : (units === 'in' ? len / dpi : len);
            const text = `${lengthVal.toFixed(2)} ${units}  ${displayAngleDeg.toFixed(1)}°`;

            // Ticks
            const px = -dy / len;
            const py = dx / len;
            const tickSize = 5;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            // Text rotation logic (keeps text upright)
            let textRot = originalAngleDeg;
            if (textRot > 90) textRot -= 180;
            if (textRot < -90) textRot += 180;
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
        }

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
                    {/* Outline for visibility */}
                    <path d={d} fill="none" stroke="rgb(56, 189, 248)" strokeWidth="1" strokeDasharray="4 4" />
                </g>
            );
        }

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
        
        // Handle drawing shapes/lines/paths
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
                         // For brush stroke mirroring, construct a temporary path object to mirror
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

       const clipModeAdornments = useMemo(() => {
        if (editingMode !== 'clip' || !activeLayer) return null;

        const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayer;
        const effectiveZoom = layerScale * viewState.zoom;
        const dynamicHandleSize = HANDLE_SIZE / effectiveZoom;
        const dynamicAnchorSize = ANCHOR_SIZE / effectiveZoom;
        const dynamicStrokeWidth = 1.5 / effectiveZoom;
        const dynamicHandleStrokeWidth = 1 / effectiveZoom;

        const pivotX = width / 2;
        const pivotY = height / 2;
        const transform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;

        // Drawing guide part
        const points = activeLayerClipPolygonPoints;
        if (!points) return null;
        const isClosed = isLayerClipPolygonClosed;
        const path = getPolygonPathWithCurves(points, isClosed);
        const startColor = 'rgb(34, 197, 94)';
        // Check if hovering close point OR simply hovering first point while drawing
        const isNearStart = (hoverInfo?.type === 'close_polygon') || (hoverInfo?.type === 'anchor' && hoverInfo.vertexIndex === 0 && !isClosed && points.length > 2);
        
        // Handle part
        const isMoving = interaction.mode === 'moving_clip_path';
        const isHoveredOnHandle = hoverInfo?.type === 'layer_handle';
        const handleStrokeColor = isHoveredOnHandle || isMoving ? 'rgb(56, 189, 248)' : 'rgba(0, 0, 0, 0.4)';
        const handleSize = 10;
        const handleX = width / 2 + offsetX;
        const handleY = height / 2 + offsetY;

        return (
            <>
                {/* Drawing Guide */}
                <g transform={transform}>
                    {points.length > 0 && <path d={path} fill={isClosed ? "rgba(0, 0, 0, 0.1)" : "none"} stroke="#cccccc" strokeWidth={dynamicStrokeWidth * (2/1.5)} />}
                    
                    {hoverInfo?.type === 'segment' && interaction.mode === 'idle' && (
                        <path 
                            d={`M ${points[hoverInfo.segmentIndex].anchor.join(',')} L ${points[(hoverInfo.segmentIndex + 1) % points.length].anchor.join(',')}`}
                            stroke="rgba(56, 189, 248, 0.8)"
                            strokeWidth={dynamicStrokeWidth * (6/1.5)}
                            strokeLinecap='round'
                        />
                    )}

                    {!isMoving && points.map((p, i) => {
                        const isHovered = (hoverInfo?.type === 'anchor' || hoverInfo?.type === 'handle') && hoverInfo.vertexIndex === i;
                        const isInteracting = (interaction.mode === 'moving_anchor' || interaction.mode === 'moving_handle' || interaction.mode === 'drawing') && interaction.vertexIndex === i;
                        const showHandles = isHovered || isInteracting;
                        
                        // In Drawing Mode, show the last point as 'interacting'
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
                    <circle cx={handleX} cy={handleY} r={handleSize / viewState.zoom} fill={isMoving ? "rgba(56, 189, 248, 0.3)" : "rgba(0, 0, 0, 0.1)"} stroke={handleStrokeColor} strokeWidth={1.5 / viewState.zoom} />
                    <line x1={handleX - handleSize/2/viewState.zoom} y1={handleY} x2={handleX + handleSize/2/viewState.zoom} y2={handleY} stroke={handleStrokeColor} strokeWidth={1.5 / viewState.zoom} />
                    <line x1={handleX} y1={handleY - handleSize/2/viewState.zoom} x2={handleX} y2={handleY + handleSize/2/viewState.zoom} stroke={handleStrokeColor} strokeWidth={1.5 / viewState.zoom} />
                </g>
            </>
        );
    }, [
        editingMode, activeLayer, activeLayerClipPolygonPoints, isLayerClipPolygonClosed, 
        hoverInfo, interaction, width, height, viewState.zoom
    ]);

    const polygonAdornments = useMemo(() => {
        const objectsToRender: PolygonObject[] = [];
        const activeLayerForAdornments = renderData.layers.find(l => l.layer.id === activeLayerId)?.layer;

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
        }
        else if (editingMode === 'shape' && activeTool === 'node' && activeLayerForAdornments) {
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
    
        const effectiveZoom = (activeLayerForAdornments?.scale || 1) * viewState.zoom;
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

                                // During a drag, hide adornments for all nodes that are not being directly manipulated.
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
                                                {/* Handle Lines - Show if exists OR if we are currently moving it (pulling it out) */}
                                                {(hasHandle1 || isMovingHandle1) && <line x1={p.anchor[0]} y1={p.anchor[1]} x2={p.handle1[0]} y2={p.handle1[1]} stroke="rgba(34, 211, 238, 0.6)" strokeWidth={dynamicHandleStrokeWidth} />}
                                                {(hasHandle2 || isMovingHandle2) && <line x1={p.anchor[0]} y1={p.anchor[1]} x2={p.handle2[0]} y2={p.handle2[1]} stroke="rgba(34, 211, 238, 0.6)" strokeWidth={dynamicHandleStrokeWidth} />}
                                                
                                                {/* Handle Knobs - Show if exists AND not being dragged */}
                                                {hasHandle1 && !isMovingHandle1 && <circle cx={p.handle1[0]} cy={p.handle1[1]} r={dynamicHandleSize} fill="rgb(34, 211, 238)" stroke="white" strokeWidth={dynamicHandleStrokeWidth} style={{ pointerEvents: 'auto' }} />}
                                                {hasHandle2 && !isMovingHandle2 && <circle cx={p.handle2[0]} cy={p.handle2[1]} r={dynamicHandleSize} fill="rgb(34, 211, 238)" stroke="white" strokeWidth={dynamicHandleStrokeWidth} style={{ pointerEvents: 'auto' }} />}
                                            </g>
                                        )}
                                        {/* Anchor Point */}
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
    }, [editingMode, activeLayerId, renderData.layers, width, height, hoverInfo, interaction, activeTool, viewState.zoom]);
    
    const staticGuides = useMemo(() => {
        const strokeW = 1 / viewState.zoom;
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
                        <line x1={width/2 - halfGap} y1={0} x2={width/2 - halfGap} y2={height} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4*strokeW} ${4*strokeW}`} />
                        <line x1={width/2 + halfGap} y1={0} x2={width/2 + halfGap} y2={height} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4*strokeW} ${4*strokeW}`} />
                    </>
                )}
                {mirrorMode === 'vertical' && (
                    <>
                        <line x1={0} y1={height/2 - halfGap} x2={width} y2={height/2 - halfGap} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4*strokeW} ${4*strokeW}`} />
                        <line x1={0} y1={height/2 + halfGap} x2={width} y2={height/2 + halfGap} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeW} strokeDasharray={`${4*strokeW} ${4*strokeW}`} />
                    </>
                )}
            </g>
        );
    }, [editingMode, isLayerClipPolygonClosed, activeLayerClipPolygonPoints, activeLayer, mirrorMode, mirrorGap, viewState.zoom, width, height]);
    
    // Render active snapping guides
    const activeSnapGuides = useMemo(() => {
        if (activeGuides.length === 0) return null;
        const strokeW = 1 / viewState.zoom;
        const activeLayerForGuides = renderData.layers.find(l => l.layer.id === activeLayerId)?.layer;
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
                        stroke="#F472B6" // bright magenta
                        strokeWidth={strokeW * 1.5}
                    />
                ))}
            </g>
        );
    }, [activeGuides, viewState.zoom, renderData.layers, activeLayerId, width, height]);

    const measurementHighlight = useMemo(() => {
        if (hoverInfo?.type === 'measure_segment') {
            return (
                <line
                    x1={hoverInfo.p1[0]}
                    y1={hoverInfo.p1[1]}
                    x2={hoverInfo.p2[0]}
                    y2={hoverInfo.p2[1]}
                    stroke="#FACC15"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    pointerEvents="none"
                />
            );
        }
        return null;
    }, [hoverInfo]);

    const selectionAdornments = useMemo(() => {
        // Hide selection controls if:
        // 1. No selection
        // 2. Editing text
        // 3. Not in shape mode (e.g. layer/clip mode)
        // 4. Actively modifying polygon points (anchors, handles, segments) to avoid visual clutter
        // 5. Actively drawing a polygon
        if (selectedObjects.length === 0 || 
            interaction.mode === 'editing_text' || 
            editingMode !== 'shape' ||
            activeTool === 'node' || // Hide for node tool
            interaction.mode === 'moving_polygon_anchor' ||
            interaction.mode === 'moving_polygon_handle' ||
            interaction.mode === 'moving_polygon_segment' ||
            interaction.mode === 'drawing_polygon'
        ) return null;

        const activeLayerForAdornments = renderData.layers.find(l => l.layer.id === activeLayerId)?.layer;
        let layerTransform = '';
        if (activeLayerForAdornments) {
            const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayerForAdornments;
            const pivotX = width / 2;
            const pivotY = height / 2;
            layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;
        }

        const isSingleSelection = selectedObjects.length === 1;
        const activeLayerScale = activeLayerForAdornments?.scale || 1;
        const strokeW = 1 / (viewState.zoom * activeLayerScale);

        // Add padding for polygon objects to avoid overlap with vertex controls
        const paddingVal = 0; // Disabled for now as node tool handles this

        let w: number, h: number;
        let objectTransform: string;
        let handleTransform: string;
        let handles: ResizeHandle[] = [];
        const handleSize = 8 * strokeW;
        const rotHandleOffset = (20 / viewState.zoom) + paddingVal;
        
        if (isSingleSelection) {
            const obj = selectedObjects[0];
            // Special case for measurement object to encompass handles
            if (obj.type === 'measurement') {
                const bounds = getObjectVisualBounds(obj);
                w = bounds.width;
                h = bounds.height;
                const cx = bounds.x + w / 2;
                const cy = bounds.y + h / 2;
                objectTransform = `translate(${cx}, ${cy}) translate(${-w/2}, ${-h/2})`;
                handleTransform = `translate(${cx}, ${cy})`; // Center for handles
            } else {
                w = obj.width;
                h = obj.height;
                const cx = obj.x + w / 2;
                const cy = obj.y + h / 2;
                // Fully skewed transform for bounding box
                objectTransform = `translate(${cx}, ${cy}) rotate(${obj.rotation}) skewX(${obj.skewX || 0}) skewY(${obj.skewY || 0}) translate(${-w/2}, ${-h/2})`;
                // Unskewed transform for handles (so they don't distort)
                handleTransform = `translate(${cx}, ${cy}) rotate(${obj.rotation})`; 
            }
        } else {
            const bounds = calculateGroupBounds(selectedObjects);
            w = bounds.width;
            h = bounds.height;
            const cx = bounds.x + w / 2;
            const cy = bounds.y + h / 2;
            
            objectTransform = `translate(${cx}, ${cy}) translate(${-w / 2}, ${-h / 2})`;
            // Fix: Handle transform must be centered for getSkewedHandlePos to work correctly
            handleTransform = `translate(${cx}, ${cy})`;
        }
        
        if (!isSingleSelection || selectedObjects[0].type !== 'measurement') {
            handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];
        }

        // Helper to calculate skewed positions for handles if needed
        const getSkewedHandlePos = (handle: ResizeHandle, objWidth: number, objHeight: number, skewX: number = 0, skewY: number = 0) => {
            // Local coords relative to top-left (0,0)
            let lx = 0, ly = 0;
            if (handle.includes('left')) lx = -paddingVal;
            else if (handle.includes('right')) lx = objWidth + paddingVal;
            else lx = objWidth / 2;

            if (handle.includes('top')) ly = -paddingVal;
            else if (handle.includes('bottom')) ly = objHeight + paddingVal;
            else ly = objHeight / 2;

            // Rel to center
            let rx = lx - objWidth / 2;
            let ry = ly - objHeight / 2;

            // Apply skew
            const skXRad = skewX * Math.PI / 180;
            const skYRad = skewY * Math.PI / 180;
            const skewedX = rx + ry * Math.tan(skXRad);
            const skewedY = rx * Math.tan(skYRad) + ry;

            return { x: skewedX, y: skewedY };
        };

        // Rotation Handle calculation (needs to be perpendicular to top edge in local unskewed space)
        // In unskewed local space relative to center: Top Center is (0, -h/2 - padding)
        // After skew, this point moves.
        // Rotation handle tip is (0, -h/2 - padding - 20/zoom).
        // We map these two points through skew to get start/end of the line in handleTransform space.
        
        const obj = isSingleSelection ? selectedObjects[0] : null;
        const skX = obj?.skewX || 0;
        const skY = obj?.skewY || 0;
        
        const topCenterY = -h/2 - paddingVal;
        const rotTipY = -h/2 - rotHandleOffset;
        
        // Base of rotation handle (top-center of selection box)
        // x=0 (center), y=topCenterY
        const rotBaseX = 0 + topCenterY * Math.tan(skX * Math.PI/180);
        const rotBaseY = 0 * Math.tan(skY * Math.PI/180) + topCenterY;
        
        // Tip of rotation handle
        // x=0, y=rotTipY
        const rotTipX = 0 + rotTipY * Math.tan(skX * Math.PI/180);
        const rotTipY_pos = 0 * Math.tan(skY * Math.PI/180) + rotTipY;

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

                {/* Handles & Rotation (Unskewed Group, manually positioned) */}
                <g transform={handleTransform}>
                    {/* Rotation Handle Line */}
                    <line x1={rotBaseX} y1={rotBaseY} x2={rotTipX} y2={rotTipY_pos} stroke="rgb(56, 189, 248)" strokeWidth={strokeW} />
                    {/* Rotation Handle Circle */}
                    <circle cx={rotTipX} cy={rotTipY_pos} r={handleSize} fill="white" stroke="rgb(56, 189, 248)" strokeWidth={strokeW} style={{ pointerEvents: 'auto' }} />
                    
                    {/* Resize Handles */}
                    {handles.map(handle => {
                        const pos = getSkewedHandlePos(handle, w, h, skX, skY);
                        return (
                            <rect 
                                key={handle} 
                                x={pos.x - handleSize/2} 
                                y={pos.y - handleSize/2} 
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
    }, [selectedObjects, interaction.mode, editingMode, renderData.layers, activeLayerId, viewState.zoom, width, height, activeTool]);

    const overlayAdornments = useMemo(() => {
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
                <text x={screenX} y={screenY} dy="0.35em" textAnchor="middle" style={{...adornmentStyle, fill: 'rgb(34, 211, 238)'}}>
                    +
                </text>
            );
        }

        // '-' on anchor shift-hover
        if (hoverInfo.type === 'polygon_anchor' && isShiftPressed) {
            const layer = renderData.layers.find(l => l.layer.id === hoverInfo.layerId)?.layer;
            const object = layer?.objects.find(o => o.id === hoverInfo.objectId) as PolygonObject;
            if (object && layer) {
                const vertex = object.points[hoverInfo.vertexIndex];
                if (vertex) {
                    const objectMatrix = getTransformMatrix(object);
                    const layerLocalAnchorPos = transformPoint(vertex.anchor, objectMatrix);
                    
                    const finalWorldPos = transformLayerLocalPointToWorld(layerLocalAnchorPos, layer, {width, height});

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
    }, [activeTool, hoverInfo, interaction.mode, mouseWorldPos, isShiftPressed, renderData.layers, viewState, rulerBreadth, width, height]);

    const draggedGuidePos = useMemo(() => {
        if (interaction.mode === 'dragging_new_guide' || interaction.mode === 'moving_guide') {
            return interaction.guide.position;
        }
        return null;
    }, [interaction]);

    const draggedGuideOrientation = useMemo(() => {
        if (interaction.mode === 'dragging_new_guide') return interaction.orientation;
        if (interaction.mode === 'moving_guide') return interaction.guide.orientation;
        return null;
    }, [interaction]);

    return (
        <div className="relative w-full h-full bg-slate-900 overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
            <svg
                ref={svgRef}
                width={viewportWidth}
                height={viewportHeight}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={handleSvgMouseLeave}
                onDoubleClick={handleSvgDoubleClick}
                style={{ cursor: getCursor(), touchAction: 'none' }}
            >
                <defs>
                    {renderData.defs}
                    <pattern id="grid" width={100 * viewState.zoom} height={100 * viewState.zoom} patternUnits="userSpaceOnUse">
                        <path d={`M ${100 * viewState.zoom} 0 L 0 0 0 ${100 * viewState.zoom}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    </pattern>
                </defs>
                
                {/* Canvas Background */}
                <rect width="100%" height="100%" fill="#0f172a" />
                
                {/* Zoom/Pan Group */}
                <g transform={`translate(${viewState.pan.x + rulerBreadth}, ${viewState.pan.y + rulerBreadth}) scale(${viewState.zoom})`}>
                    
                    {/* Artboard */}
                    <rect x="0" y="0" width={width} height={height} fill="white" />
                    <rect x="0" y="0" width={width} height={height} fill="url(#grid)" />

                    {/* Draggable Guides */}
                    <g className="guides">
                        {guides.map(guide => {
                            const isHovered = hoverInfo?.type === 'guide' && hoverInfo.guide.id === guide.id;
                            const isMoving = interaction.mode === 'moving_guide' && interaction.guide.id === guide.id;
                            return (
                                <line
                                    key={guide.id}
                                    x1={guide.orientation === 'vertical' ? guide.position : -10000}
                                    y1={guide.orientation === 'horizontal' ? guide.position : -10000}
                                    x2={guide.orientation === 'vertical' ? guide.position : 10000}
                                    y2={guide.orientation === 'horizontal' ? guide.position : 10000}
                                    stroke={isHovered || isMoving ? '#38bdf8' : '#06b6d4'}
                                    strokeWidth={isHovered || isMoving ? 2 / viewState.zoom : 1 / viewState.zoom}
                                    style={{ pointerEvents: 'stroke' }}
                                />
                            );
                        })}
                        {interaction.mode === 'dragging_new_guide' && (
                            <line
                                x1={interaction.orientation === 'vertical' ? interaction.guide.position : -10000}
                                y1={interaction.orientation === 'horizontal' ? interaction.guide.position : -10000}
                                x2={interaction.orientation === 'vertical' ? interaction.guide.position : 10000}
                                y2={interaction.orientation === 'horizontal' ? interaction.guide.position : 10000}
                                stroke="#38bdf8"
                                strokeWidth={1 / viewState.zoom}
                            />
                        )}
                    </g>

                    {/* Layers */}
                    {renderData.layers.map((l) => {
                        const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = l.layer;
                        const pivotX = width / 2;
                        const pivotY = height / 2;
                        const layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;

                        const clipPath = (l.layer.useClipping && l.layer.isClipPolygonClosed) ? `url(#clip-${l.layer.id})` : undefined;

                        return (
                            <g 
                                key={l.layer.id} 
                                transform={layerTransform} 
                                clipPath={clipPath} 
                                style={{ 
                                    opacity: l.layer.visible ? 1 : 0, 
                                    mixBlendMode: l.layer.blendMode === 'normal' ? 'normal' : l.layer.blendMode as BlendMode,
                                    pointerEvents: l.layer.isLocked ? 'none' : 'auto' 
                                }}
                            >
                                {l.elements.map(el => {
                                    // Hide the text object currently being edited to prevent duplication with the overlay editor
                                    if (interaction.mode === 'editing_text' && 
                                        l.layer.id === interaction.layerId && 
                                        el.key === `${l.layer.id}-obj-${interaction.objectId}`) {
                                        return null;
                                    }

                                    const Component = el.type as any;
                                    return <Component key={el.key} {...el.props} />;
                                })}
                            </g>
                        );
                    })}

                    {/* Interactive Elements */}
                    {drawingPreview}
                    
                    {/* Pattern Preview */}
                    {patternPreviewData && activeLayer && patternPreviewObjects.length > 0 && (() => {
                        const obj = patternPreviewObjects[0];
                        const clipId = `preview-clip-${obj.id}`;
                        
                        const { offsetX = 0, offsetY = 0, rotation = 0, scale: layerScale = 1, skewX = 0, skewY = 0 } = activeLayer;
                        const pivotX = width / 2;
                        const pivotY = height / 2;
                        const layerTransform = `translate(${offsetX + pivotX}, ${offsetY + pivotY}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${layerScale}) translate(${-pivotX}, ${-pivotY})`;
                        
                        const previewColor = "#000000";
                        let content = null;

                        if (patternPreviewData.type === 'circles' || patternPreviewData.type === 'halftone' || patternPreviewData.type === 'stipple') {
                            const circles = (patternPreviewData as any).circles;
                            content = (
                                <g>
                                    {circles.map((c: any, i: number) => (
                                        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={previewColor} />
                                    ))}
                                </g>
                            );
                        } else if (patternPreviewData.type === 'words') {
                            const words = (patternPreviewData as any).words;
                            content = (
                                <g>
                                    {words.map((w: any, i: number) => (
                                        <text 
                                            key={i} 
                                            x={w.x} y={w.y} 
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
                            // Path based patterns
                            const paths = (patternPreviewData as any).paths;
                            content = (
                                <g>
                                    {paths.map((d: string, i: number) => (
                                        <path key={i} d={d} fill="none" stroke={previewColor} strokeWidth="1" />
                                    ))}
                                </g>
                            );
                        }

                        let clipElement = null;
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
                    })()}

                    {staticGuides}
                    {activeSnapGuides}
                    {clipModeAdornments}
                    {measurementHighlight}
                    {selectionAdornments}
                    {polygonAdornments}
                </g>
                
                {/* Adornments not subject to pan/zoom */}
                <g>
                    {overlayAdornments}
                </g>
            </svg>
            
            {/* Rulers */}
            <div className="absolute top-0 left-0 w-full h-[30px] overflow-hidden pointer-events-none">
                <svg width={viewportWidth} height={rulerBreadth} className="bg-slate-950 border-b border-slate-800">
                    <Ruler orientation="horizontal" size={viewportWidth} breadth={rulerBreadth} units={units} dpi={dpi} zoom={viewState.zoom} panOffset={viewState.pan.x + rulerBreadth} mousePos={mouseScreenPos ? mouseScreenPos[0] + rulerBreadth : null} draggedGuidePos={draggedGuideOrientation === 'vertical' ? draggedGuidePos : null} />
                </svg>
            </div>
            <div className="absolute top-0 left-0 w-[30px] h-full overflow-hidden pointer-events-none">
                <svg width={rulerBreadth} height={viewportHeight} className="bg-slate-950 border-r border-slate-800">
                    <Ruler orientation="vertical" size={viewportHeight} breadth={rulerBreadth} units={units} dpi={dpi} zoom={viewState.zoom} panOffset={viewState.pan.y + rulerBreadth} mousePos={mouseScreenPos ? mouseScreenPos[1] + rulerBreadth : null} draggedGuidePos={draggedGuideOrientation === 'horizontal' ? draggedGuidePos : null} />
                </svg>
            </div>
            <div className="absolute top-0 left-0 w-[30px] h-[30px] bg-slate-950 z-10 border-r border-b border-slate-800 flex items-center justify-center text-xs text-slate-100 uppercase font-mono select-none">
                {units}
            </div>

            {/* Inline Text Editor */}
            {interaction.mode === 'editing_text' && activeLayerId && (
                <InlineTextEditor 
                    object={renderData.layers.find(l => l.layer.id === interaction.layerId)?.layer.objects.find(o => o.id === interaction.objectId) as TextObject}
                    viewState={viewState}
                    rulerBreadth={rulerBreadth}
                    onUpdate={onUpdateTextContent}
                    onFinish={onFinishTextEditing}
                />
            )}
        </div>
    );
};

export default Canvas;