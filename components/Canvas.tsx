import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import type { 
    Point, 
    PolygonVertex, 
    HoverInfo, 
    InteractionState, 
    RenderableElement, 
    Layer, 
    Units, 
    VectorObject, 
    MirrorMode, 
    PrimitivePatternData, 
    BlendMode, 
    Guide, 
    TextObject 
} from '../types';
import { useEditor } from '../context/EditorContext';
import { performHitTest, calculateCanvasCursor } from '../lib/hit-test';
import { InlineTextEditor } from './canvas/InlineTextEditor';
import { CanvasRulersOverlay } from './canvas/CanvasRulers';
import { DrawingPreview } from './canvas/DrawingPreview';
import { ClipModeAdornments } from './canvas/ClipModeAdornments';
import { PolygonAdornments } from './canvas/PolygonAdornments';
import { SelectionAdornments } from './canvas/SelectionAdornments';
import { StaticAndSnapGuides } from './canvas/StaticAndSnapGuides';
import { OverlayAdornments } from './canvas/OverlayAdornments';
import { PatternPreview } from './canvas/PatternPreview';

interface CanvasProps {
    width: number; 
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    clipToCanvas?: boolean;
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
    viewState: { zoom: number; pan: { x: number; y: number } };
    setViewState: React.Dispatch<React.SetStateAction<{ zoom: number; pan: { x: number; y: number } }>>;
    mirrorMode: MirrorMode;
    mirrorGap: number;
    patternPreviewData: PrimitivePatternData | null;
    patternPreviewObjects: VectorObject[];
    children?: React.ReactNode;
}

/**
 * The main interactive canvas component.
 * Coordinates rendering of vector objects, user interactions, zoom/pan,
 * rulers, and overlay controls.
 */
const Canvas: React.FC<CanvasProps> = (props) => {
    const {
        width, height,
        viewportWidth, viewportHeight,
        clipToCanvas,
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
    } = props;

    const svgRef = useRef<SVGSVGElement>(null);
    const { activeGuides } = useEditor();

    const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
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

    const getPointFromEvent = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        
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
                setViewState(prev => ({ ...prev, pan: { ...prev.pan, x: prev.pan.x - e.deltaY } }));
            } else {
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
        
        const worldX = (mouseScreenX - pan.x) / zoom;
        const worldY = (mouseScreenY - pan.y) / zoom;
    
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
        if (isSpacePressed || e.button === 1) {
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
        
        if (hoverInfo?.type === 'guide') {
            onCanvasMouseDown(worldPoint, hoverInfo, e.altKey, e.shiftKey);
            return;
        }

        if (screenY < rulerBreadth && screenX > rulerBreadth) {
            onRulerMouseDown('horizontal', worldPoint);
            return;
        }
        if (screenX < rulerBreadth && screenY > rulerBreadth) {
            onRulerMouseDown('vertical', worldPoint);
            return;
        }

        if (screenX > rulerBreadth && screenY > rulerBreadth) {
            onCanvasMouseDown(worldPoint, hoverInfo, e.altKey, e.shiftKey);
        }
    };

    const handleSvgDoubleClick = () => {
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

        const { foundInfo, pointForMove } = performHitTest({
            worldPoint,
            viewState,
            interaction,
            editingMode,
            activeTool,
            activeLayerId,
            activeLayer,
            activeLayerClipPolygonPoints,
            layers: renderData.layers,
            selectedObjects,
            guides,
            width,
            height,
        });

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

    const cursor = useMemo(() => calculateCanvasCursor({
        isPanningState,
        isSpacePressed,
        isShiftPressed,
        isAltPressed,
        interaction,
        hoverInfo,
        editingMode,
        activeTool,
        selectedObjects
    }), [isPanningState, isSpacePressed, isShiftPressed, isAltPressed, interaction, hoverInfo, editingMode, activeTool, selectedObjects]);

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
                style={{ cursor, touchAction: 'none' }}
            >
                <defs>
                    <clipPath id="canvas-clip">
                        <rect x="0" y="0" width={width} height={height} />
                    </clipPath>
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

                    {/* Canvas Clustered Content */}
                    <g clipPath={clipToCanvas ? "url(#canvas-clip)" : undefined}>
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

                        {/* Interactive Drawing Preview */}
                        <DrawingPreview
                            interaction={interaction}
                            mirrorMode={mirrorMode}
                            mirrorGap={mirrorGap}
                            width={width}
                            height={height}
                            dpi={dpi}
                            units={units}
                        />
                        
                        {/* Pattern Preview */}
                        <PatternPreview
                            patternPreviewData={patternPreviewData}
                            activeLayer={activeLayer}
                            patternPreviewObjects={patternPreviewObjects}
                            width={width}
                            height={height}
                        />
                    </g>

                    <StaticAndSnapGuides
                        editingMode={editingMode}
                        isLayerClipPolygonClosed={isLayerClipPolygonClosed}
                        activeLayerClipPolygonPoints={activeLayerClipPolygonPoints}
                        activeLayer={activeLayer}
                        mirrorMode={mirrorMode}
                        mirrorGap={mirrorGap}
                        zoom={viewState.zoom}
                        width={width}
                        height={height}
                        activeGuides={activeGuides}
                        layers={renderData.layers}
                        activeLayerId={activeLayerId}
                    />

                    {measurementHighlight}

                    <SelectionAdornments
                        selectedObjects={selectedObjects}
                        interaction={interaction}
                        editingMode={editingMode}
                        activeTool={activeTool}
                        activeLayerId={activeLayerId}
                        layers={renderData.layers}
                        zoom={viewState.zoom}
                        width={width}
                        height={height}
                    />

                    <PolygonAdornments
                        editingMode={editingMode}
                        activeTool={activeTool}
                        activeLayerId={activeLayerId}
                        layers={renderData.layers}
                        hoverInfo={hoverInfo}
                        interaction={interaction}
                        width={width}
                        height={height}
                        zoom={viewState.zoom}
                    />

                    <ClipModeAdornments
                        editingMode={editingMode}
                        activeLayer={activeLayer}
                        activeLayerClipPolygonPoints={activeLayerClipPolygonPoints}
                        isLayerClipPolygonClosed={isLayerClipPolygonClosed}
                        hoverInfo={hoverInfo}
                        interaction={interaction}
                        width={width}
                        height={height}
                        zoom={viewState.zoom}
                    />
                </g>
                
                {/* Adornments not subject to pan/zoom */}
                <g>
                    <OverlayAdornments
                        activeTool={activeTool}
                        hoverInfo={hoverInfo}
                        interaction={interaction}
                        mouseWorldPos={mouseWorldPos}
                        isShiftPressed={isShiftPressed}
                        layers={renderData.layers}
                        viewState={viewState}
                        rulerBreadth={rulerBreadth}
                        width={width}
                        height={height}
                    />
                </g>
            </svg>
            
            {/* Viewport Rulers */}
            <CanvasRulersOverlay
                viewportWidth={viewportWidth}
                viewportHeight={viewportHeight}
                rulerBreadth={rulerBreadth}
                units={units}
                dpi={dpi}
                zoom={viewState.zoom}
                pan={viewState.pan}
                mouseScreenPos={mouseScreenPos}
                draggedGuidePos={draggedGuidePos}
                draggedGuideOrientation={draggedGuideOrientation}
            />

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
