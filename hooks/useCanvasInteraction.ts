


import React, { useCallback } from 'react';
import { produce } from 'immer';
import type { AppState, Point, InteractionState, HoverInfo, Layer, LayerSettings, VectorObject, VectorObjectType, ResizeHandle, PolygonObject, TextObject, PathObject, LineObject, PolygonVertex, ShapeType, ShapeObject, GenericPathObject, FlowGuideObject, GroupObject, ImageObject, MirrorMode, SnapSettings, ActiveGuide, MeasurementObject, Guide } from '../types';
import { add, sub, scale, dot, rotatePoint, calculatePolygonBounds, calculatePathBounds, getObjectHandlePosition, getLayerHandlePosition, getSmoothedPolylinePath, calculateGroupBounds, getObjectVisualBounds, applyMirrorToObject, transformLayerLocalPointToWorld, transformWorldPointToLayerLocal } from '../lib/geometry';
import { measureText } from '../lib/text-utils';
import { generateObjectsFromBrushStroke } from '../lib/brush-generator';
import { googleFonts } from '../lib/utils';
import { calculateSnapping } from '../lib/snapping';

interface UseCanvasInteractionProps {
    /** Current interaction state (e.g., idle, drawing, moving) */
    interaction: InteractionState;
    /** Setter for interaction state */
    setInteraction: React.Dispatch<React.SetStateAction<InteractionState>>;
    /** Current editing mode of the application */
    editingMode: 'shape' | 'clip' | 'layer';
    /** Complete application state */
    appState: AppState;
    /** State setter with coalesce option */
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
    /** Currently active layer object */
    activeLayer: Layer | undefined;
    /** List of currently selected vector objects */
    selectedObjects: VectorObject[];
    /** Metadata about the current selection */
    selectedObjectInfo: { layerId: string; objectIds: string[] } | null;
    /** Setter for selected object metadata */
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    /** Currently active tool */
    activeTool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure';
    /** Setter for active tool */
    setActiveTool: React.Dispatch<React.SetStateAction<'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure'>>;
    /** Currently selected shape type for the shape tool */
    activeShapeType: ShapeType;
    /** Mirroring configuration */
    mirrorMode: MirrorMode;
    /** Gap for mirroring */
    mirrorGap: number;
    /** Helper to update the active layer */
    handleUpdateActiveLayer: (updater: (layer: Layer) => void) => void;
    /** Helper to update selected objects */
    handleUpdateSelectedObjects: (props: Partial<VectorObject>) => void;
    /** Helper to update layer pattern settings */
    updateLayerPattern: (layer: Layer, newSettings: Partial<LayerSettings>) => void;
    /** Function to dynamically load Google Fonts */
    loadGoogleFonts: (fonts: Set<string>) => void;
    /** Settings for the currently active tool */
    toolSettings: Partial<VectorObject & TextObject>;
    /** Helper to start file import */
    handleInitiateImport: (file: File, type: 'svg' | 'image', point?: Point) => void;
    /** Current snapping settings */
    snapSettings: SnapSettings;
    /** Setter for active alignment guides */
    setActiveGuides: React.Dispatch<React.SetStateAction<ActiveGuide[]>>;
    /** Function to finalize the current history entry */
    commitHistory: () => void;
}

/**
 * Custom hook to handle mouse and pointer interactions on the canvas.
 * Manages states for drawing (polygons, paths, shapes), moving/resizing/rotating objects,
 * editing clip paths, moving/rotating/scaling layers, and selecting objects.
 *
 * @param props - The hook properties containing state and handlers from other managers.
 * @returns An object containing event handlers for mouse down, move, up, double click, text editing, and clearing clip paths.
 */
export const useCanvasInteraction = ({
    interaction,
    setInteraction,
    editingMode,
    appState,
    setAppState,
    activeLayer,
    selectedObjects,
    selectedObjectInfo,
    setSelectedObjectInfo,
    activeTool,
    setActiveTool,
    activeShapeType,
    mirrorMode,
    mirrorGap,
    handleUpdateActiveLayer,
    handleUpdateSelectedObjects,
    updateLayerPattern,
    loadGoogleFonts,
    toolSettings,
    handleInitiateImport,
    snapSettings,
    setActiveGuides,
    commitHistory
}: UseCanvasInteractionProps) => {

    const { layers, activeLayerId, canvasConfig } = appState;
    const { width: contentWidth, height: contentHeight } = canvasConfig;

    // FIX: Add handler for ruler interaction to create guides
    const handleRulerMouseDown = useCallback((orientation: 'horizontal' | 'vertical', point: Point) => {
        const newGuide: Guide = {
            id: `guide-${Date.now()}`,
            orientation,
            position: orientation === 'horizontal' ? point[1] : point[0],
        };
    
        setInteraction({
            mode: 'dragging_new_guide',
            orientation,
            guide: newGuide,
        });
    }, [setInteraction]);

    /**
     * Handles the mouse down event on the canvas.
     * Initiates various interaction modes based on the active tool, current editing mode, and what was clicked.
     * Supports initiating moves, resizes, rotations, drawing new shapes, and marquee selection.
     */
    const handleCanvasMouseDown = useCallback((point: Point, hitInfo: HoverInfo | null, altKey: boolean, shiftKey: boolean) => {
    // Commit any pending history (e.g. from keyboard nudges) before starting a new interaction
    commitHistory();

    if (interaction.mode === 'editing_text') {
        return;
    }

    // FIX: Handle moving an existing guide
    if (hitInfo?.type === 'guide') {
        setInteraction({ mode: 'moving_guide', guide: hitInfo.guide });
        return;
    }
    
    if (editingMode === 'layer') {
        if (!activeLayer) return;
        const center: Point = [contentWidth / 2, contentHeight / 2];
        if (hitInfo?.type === 'layer_resize_handle') {
            const oppositeHandleMap: Record<ResizeHandle, ResizeHandle> = { 'top-left': 'bottom-right', 'top-right': 'bottom-left', 'bottom-left': 'top-right', 'bottom-right': 'top-left', 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left', 'start': 'end', 'end': 'start' };
            const oppositeHandlePosUntransformed = getLayerHandlePosition(oppositeHandleMap[hitInfo.handle], contentWidth, contentHeight);

            const { offsetX, offsetY, rotation, scale: layerScale } = activeLayer;
            const pivotX = contentWidth / 2;
            const pivotY = contentHeight / 2;
            const rad = (rotation || 0) * Math.PI / 180;

            let pivotPointRel = sub(oppositeHandlePosUntransformed, [pivotX, pivotY]);
            pivotPointRel = scale(pivotPointRel, layerScale || 1);
            pivotPointRel = rotatePoint(pivotPointRel, [0, 0], rad);
            const pivotPoint = add(pivotPointRel, [pivotX + (offsetX || 0), pivotY + (offsetY || 0)]);
            
            setInteraction({ mode: 'resizing_layer', startLayer: activeLayer, handle: hitInfo.handle, startPoint: point, pivotPoint });
        } else if (hitInfo?.type === 'layer_rotate_handle') {
            const startAngle = Math.atan2(point[1] - center[1], point[0] - center[0]);
            setInteraction({ mode: 'rotating_layer', startLayer: activeLayer, center, startAngle });
        } else {
            setInteraction({ mode: 'moving_layer', startPoint: point, startOffsetX: activeLayer.offsetX, startOffsetY: activeLayer.offsetY });
        }
        return;
    }
    if (editingMode === 'clip') {
        if (hitInfo?.type === 'layer_handle' && activeLayer) {
            setInteraction({ mode: 'moving_clip_path', startPoint: point, startClipPoints: activeLayer.clipPolygonPoints });
            return;
        }

        const currentPoints = activeLayer?.clipPolygonPoints || [];
        const isClosed = activeLayer?.isClipPolygonClosed || false;
        
        const updatePoints = (updater: (draft: PolygonVertex[]) => PolygonVertex[]) => {
            handleUpdateActiveLayer(layer => { layer.clipPolygonPoints = updater(layer.clipPolygonPoints); });
        };
        const setClosed = (closed: boolean) => {
            handleUpdateActiveLayer(layer => { layer.isClipPolygonClosed = closed; });
        };

        if (interaction.mode === 'drawing') {
             if (hitInfo?.type === 'close_polygon') {
                 updatePoints(prev => prev.slice(0, -1)); // Remove floating point
                 setClosed(true);
                 setInteraction({ mode: 'idle' });
             } else {
                 // Confirm current floating point and add new one
                 const localPoint = transformWorldPointToLayerLocal(point, activeLayer!, canvasConfig);
                 const newVertex: PolygonVertex = { anchor: localPoint, handle1: localPoint, handle2: localPoint };
                 updatePoints(prev => [...prev, newVertex]);
                 // Index increases by 1
                 setInteraction(prev => {
                     if (prev.mode !== 'drawing') return prev;
                     return { ...prev, vertexIndex: prev.vertexIndex + 1 };
                 });
             }
             return;
        }

        if (hitInfo) {
            if (hitInfo.type === 'anchor') {
                if (shiftKey) { 
                    const vertexIndex = hitInfo.vertexIndex;
                    let newLength = 0;
                    updatePoints(prev => { const newPoints = [...prev]; newPoints.splice(vertexIndex, 1); newLength = newPoints.length; return newPoints; });
                    if (isClosed && newLength < 3) setClosed(false);
                    setInteraction({ mode: 'idle' });
                    return;
                }
                if (altKey && currentPoints[hitInfo.vertexIndex]) {
                    setInteraction({ mode: 'moving_handle', vertexIndex: hitInfo.vertexIndex, handleKey: 'handle2' });
                } else if (!isClosed && hitInfo.vertexIndex === 0 && currentPoints.length > 2) {
                    setClosed(true); setInteraction({ mode: 'idle' });
                } else {
                    setInteraction({ mode: 'moving_anchor', vertexIndex: hitInfo.vertexIndex, startPoint: point, startVertex: currentPoints[hitInfo.vertexIndex] });
                }
            } else if (hitInfo.type === 'handle') {
                setInteraction({ mode: 'moving_handle', ...hitInfo });
            } else if (hitInfo.type === 'segment') { 
                const newVertex: PolygonVertex = { anchor: point, handle1: point, handle2: point };
                const segmentIndex = hitInfo.segmentIndex;
                updatePoints(prev => { const newPoints = [...prev]; newPoints.splice(segmentIndex + 1, 0, newVertex); return newPoints; });
                setInteraction({ mode: 'moving_anchor', vertexIndex: segmentIndex + 1, startPoint: point, startVertex: newVertex, });
            }
        } else {
            if (isClosed) return;
            // Start drawing: Add Start Point + Floating Point
            const localPoint = transformWorldPointToLayerLocal(point, activeLayer!, canvasConfig);
            const startVertex: PolygonVertex = { anchor: localPoint, handle1: localPoint, handle2: localPoint };
            const floatVertex: PolygonVertex = { anchor: localPoint, handle1: localPoint, handle2: localPoint };
            updatePoints(prev => [...prev, startVertex, floatVertex]);
            setInteraction({ mode: 'drawing', vertexIndex: currentPoints.length + 1 });
        }
    } else { 
        if (hitInfo?.type === 'resize_handle') {
            const { layerId, objectId, handle } = hitInfo;
            const layer = layers.find(l => l.id === layerId);
            if (!layer) return;

            if (selectedObjects.length > 1) {
                const startGroupBounds = calculateGroupBounds(selectedObjects);
                const getGroupHandlePosition = (bounds: {x:number, y:number, width:number, height:number}, handle: ResizeHandle): Point => {
                    let x=0, y=0;
                    if (handle.includes('left')) x = 0; else if (handle.includes('right')) x = bounds.width; else x = bounds.width / 2;
                    if (handle.includes('top')) y = 0; else if (handle.includes('bottom')) y = bounds.height; else y = bounds.height / 2;
                    return [bounds.x + x, bounds.y + y];
                };
                const oppositeHandleMap: Record<ResizeHandle, ResizeHandle> = { 'top-left': 'bottom-right', 'top-right': 'bottom-left', 'bottom-left': 'top-right', 'bottom-right': 'top-left', 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left', 'start': 'end', 'end': 'start' };
                const pivotHandle = oppositeHandleMap[handle];
                const pivotPoint = getGroupHandlePosition(startGroupBounds, pivotHandle);
                setInteraction({ mode: 'resizing_group', layerId, startObjects: JSON.parse(JSON.stringify(selectedObjects)), handle, startGroupBounds, pivotPoint });

            } else if (selectedObjects.length === 1) {
                const object = selectedObjects[0];
                setSelectedObjectInfo({ layerId, objectIds: [objectId] });

                if (object.type === 'group') {
                    const group = object as GroupObject;
                    const children = layer.objects.filter(o => group.objectIds.includes(o.id));
                    const startGroupBounds = calculateGroupBounds(children);
                    const getGroupHandlePosition = (bounds: {x:number, y:number, width:number, height:number}, handle: ResizeHandle): Point => {
                        let x=0, y=0;
                        if (handle.includes('left')) x = bounds.x; else if (handle.includes('right')) x = bounds.x + bounds.width; else x = bounds.x + bounds.width / 2;
                        if (handle.includes('top')) y = bounds.y; else if (handle.includes('bottom')) y = bounds.y + bounds.height; else y = bounds.y + bounds.height / 2;
                        return [x, y];
                    };
                    const oppositeHandleMap: Record<ResizeHandle, ResizeHandle> = { 'top-left': 'bottom-right', 'top-right': 'bottom-left', 'bottom-left': 'top-right', 'bottom-right': 'top-left', 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left', 'start': 'end', 'end': 'start' };
                    const pivotHandle = oppositeHandleMap[handle];
                    const pivotPoint = getGroupHandlePosition(startGroupBounds, pivotHandle);
                    setInteraction({ mode: 'resizing_group', layerId, startObjects: JSON.parse(JSON.stringify(children)), handle, startGroupBounds, pivotPoint });
                } else {
                    let mirroredObjectId: string | undefined;
                    if (mirrorMode !== 'off') {
                        const mirroredId = object.id.startsWith('mirror-') ? object.id.substring(7) : `mirror-${object.id}`;
                        if (layer?.objects.some(o => o.id === mirroredId)) {
                            mirroredObjectId = mirroredId;
                        }
                    }
                    setInteraction({ mode: 'resizing_object', layerId, objectId, startObject: object, handle, mirroredObjectId });
                }
            }
        } else if (hitInfo?.type === 'rotate_handle') {
            const { layerId, objectId } = hitInfo;
            const layer = layers.find(l => l.id === layerId);
            if (!layer) return;

            if (selectedObjects.length > 1) {
                const groupBounds = calculateGroupBounds(selectedObjects);
                const groupCenter: Point = [groupBounds.x + groupBounds.width / 2, groupBounds.y + groupBounds.height / 2];
                const worldGroupCenter = transformLayerLocalPointToWorld(groupCenter, layer, canvasConfig);
                const startAngle = Math.atan2(point[1] - worldGroupCenter[1], point[0] - worldGroupCenter[0]);
                setInteraction({ mode: 'rotating_group', layerId, startObjects: JSON.parse(JSON.stringify(selectedObjects)), groupCenter: worldGroupCenter, startAngle });
            } else if (selectedObjects.length === 1) {
                const object = selectedObjects[0];
                setSelectedObjectInfo({ layerId, objectIds: [objectId] });

                if (object.type === 'group') {
                    const group = object as GroupObject;
                    const children = layer.objects.filter(o => group.objectIds.includes(o.id));
                    const groupBounds = calculateGroupBounds(children);
                    const groupCenter: Point = [groupBounds.x + groupBounds.width / 2, groupBounds.y + groupBounds.height / 2];
                    const worldGroupCenter = transformLayerLocalPointToWorld(groupCenter, layer, canvasConfig);
                    const startAngle = Math.atan2(point[1] - worldGroupCenter[1], point[0] - worldGroupCenter[0]);
                    setInteraction({ mode: 'rotating_group', layerId, startObjects: JSON.parse(JSON.stringify(children)), groupCenter: worldGroupCenter, startAngle });
                } else {
                    const center: Point = [object.x + object.width / 2, object.y + object.height / 2];
                    const worldCenter = transformLayerLocalPointToWorld(center, layer, canvasConfig);
                    const startAngle = Math.atan2(point[1] - worldCenter[1], point[0] - worldCenter[0]);

                    let mirroredObjectId: string | undefined;
                    let startMirroredObject: VectorObject | undefined;
                    if (mirrorMode !== 'off') {
                        const mirroredId = object.id.startsWith('mirror-') ? object.id.substring(7) : `mirror-${object.id}`;
                        const mirroredObj = layer?.objects.find(o => o.id === mirroredId);
                        if (mirroredObj) {
                            mirroredObjectId = mirroredId;
                            startMirroredObject = mirroredObj;
                        }
                    }

                    setInteraction({ mode: 'rotating_object', layerId, objectId, startObject: object, center: worldCenter, startAngle, mirroredObjectId, startMirroredObject });
                }
            }
        } else if (activeTool === 'select' || activeTool === 'node') {
             if (hitInfo?.type === 'object') {
                const { layerId, objectId } = hitInfo;
                const isAlreadySelected = selectedObjectInfo?.layerId === layerId && selectedObjectInfo.objectIds.includes(objectId);
                
                let nextSelectedObjectsInfo = selectedObjectInfo;
                if (shiftKey) {
                    if (selectedObjectInfo && selectedObjectInfo.layerId === layerId) {
                        const objectIds = isAlreadySelected
                            ? selectedObjectInfo.objectIds.filter(id => id !== objectId)
                            : [...selectedObjectInfo.objectIds, objectId];
                        nextSelectedObjectsInfo = objectIds.length > 0 ? { layerId, objectIds } : null;
                    } else { 
                        nextSelectedObjectsInfo = { layerId, objectIds: [objectId] };
                    }
                } else {
                    if (!isAlreadySelected) {
                        nextSelectedObjectsInfo = { layerId, objectIds: [objectId] };
                    }
                }
                setSelectedObjectInfo(nextSelectedObjectsInfo);
                
                if (nextSelectedObjectsInfo) {
                    setAppState(produce((draft: AppState) => {
                        draft.activeLayerId = nextSelectedObjectsInfo!.layerId;
                    }));
                }
                
                const nextSelectedObjects = (() => {
                    if (!nextSelectedObjectsInfo) return [];
                    const layer = layers.find(l => l.id === nextSelectedObjectsInfo.layerId);
                    if (!layer) return [];
                    return nextSelectedObjectsInfo.objectIds.map(id => layer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];
                })();

                if (nextSelectedObjects.length > 0 && activeTool === 'select') {
                    const layerForExpansion = layers.find(l => l.id === nextSelectedObjectsInfo!.layerId)!;
                    const allObjectsToMove = new Map<string, VectorObject>();

                    const collectChildObjects = (obj: VectorObject) => {
                        if (allObjectsToMove.has(obj.id)) return;
                        allObjectsToMove.set(obj.id, obj);

                        if (obj.type === 'group') {
                            (obj as GroupObject).objectIds.forEach(childId => {
                                const child = layerForExpansion.objects.find(o => o.id === childId);
                                if (child) {
                                    collectChildObjects(child);
                                }
                            });
                        }
                    };
                    nextSelectedObjects.forEach(collectChildObjects);
                    
                    if (mirrorMode !== 'off') {
                        const mirroredIds = new Set<string>();
                        allObjectsToMove.forEach(obj => {
                             const mirroredId = obj.id.startsWith('mirror-') ? obj.id.substring(7) : `mirror-${obj.id}`;
                             if (!allObjectsToMove.has(mirroredId)) {
                                 const mirroredObj = layerForExpansion.objects.find(o => o.id === mirroredId);
                                 if (mirroredObj) {
                                     mirroredIds.add(mirroredId);
                                 }
                             }
                        });
                        mirroredIds.forEach(id => {
                            const mirroredObj = layerForExpansion.objects.find(o => o.id === id);
                            if (mirroredObj) {
                                collectChildObjects(mirroredObj);
                            }
                        });
                    }

                    setInteraction({ 
                        mode: 'moving_object', 
                        layerId,
                        startPoint: point, 
                        startObjects: JSON.parse(JSON.stringify(Array.from(allObjectsToMove.values())))
                    });
                }
            } else if (hitInfo?.type === 'polygon_anchor' || hitInfo?.type === 'polygon_handle' || hitInfo?.type === 'polygon_segment') {
                const { layerId, objectId } = hitInfo;
                const layer = layers.find(l => l.id === layerId);
                const object = layer?.objects.find(o => o.id === objectId) as PolygonObject | undefined;
                if (!layer || !object) return;

                setSelectedObjectInfo({ layerId, objectIds: [objectId] });
                setAppState(produce((draft: AppState) => { draft.activeLayerId = layerId; }));
                
                if (hitInfo.type === 'polygon_anchor') {
                     if (shiftKey && object.points.length > (object.isClosed ? 3 : 2)) {
                        const newPoints = [...object.points];
                        newPoints.splice(hitInfo.vertexIndex, 1);
                        handleUpdateSelectedObjects({ points: newPoints });
                        setInteraction({ mode: 'idle' });
                        return;
                    }

                    if (altKey && object.points[hitInfo.vertexIndex]) {
                        // Alt-Dragging an anchor pulls out handles
                        setInteraction({
                            mode: 'moving_polygon_handle',
                            layerId,
                            objectId,
                            vertexIndex: hitInfo.vertexIndex,
                            handleKey: 'handle2'
                        });
                        return;
                    }

                     if (!object.isClosed && hitInfo.vertexIndex === 0 && object.points.length > 2) {
                        handleUpdateSelectedObjects({ isClosed: true });
                        setInteraction({ mode: 'idle' });
                    } else {
                        setInteraction({ mode: 'moving_polygon_anchor', layerId, objectId, vertexIndex: hitInfo.vertexIndex, startPoint: point, startVertex: object.points[hitInfo.vertexIndex] });
                    }
                } else if (hitInfo.type === 'polygon_handle') {
                    setInteraction({ mode: 'moving_polygon_handle', layerId, objectId, vertexIndex: hitInfo.vertexIndex, handleKey: hitInfo.handleKey });
                } else if (hitInfo.type === 'polygon_segment') {
                    const newVertex: PolygonVertex = { anchor: point, handle1: point, handle2: point };
                    handleUpdateSelectedObjects({ points: [...object.points.slice(0, hitInfo.segmentIndex + 1), newVertex, ...object.points.slice(hitInfo.segmentIndex + 1)] });
                    setInteraction({ mode: 'moving_polygon_anchor', layerId, objectId, vertexIndex: hitInfo.segmentIndex + 1, startPoint: point, startVertex: newVertex });
                }
            } else {
                if (!hitInfo && !shiftKey && activeTool !== 'node') { 
                    setSelectedObjectInfo(null);
                }
                if (!hitInfo && activeTool === 'select') {
                    setInteraction({ mode: 'marquee_selection', startPoint: point, currentPoint: point, shiftKey });
                }
            }
        } else if (activeTool === 'polygon') {
            if (interaction.mode === 'drawing_polygon') {
                 const currentObject = interaction.object;
                 const { mirroredObjectId } = interaction;
                 
                 if (hitInfo?.type === 'close_polygon') {
                    setAppState(produce(draft => {
                        const layer = draft.layers.find(l => l.id === draft.activeLayerId);
                        const obj = layer?.objects.find(o => o.id === currentObject.id) as PolygonObject | undefined;
                        if(obj) {
                            obj.isClosed = true;
                            // Remove the "floating" point
                            obj.points.pop();
                            Object.assign(obj, calculatePolygonBounds(obj.points));
                        }

                        if(mirroredObjectId) {
                            const mirroredObj = layer?.objects.find(o => o.id === mirroredObjectId) as PolygonObject | undefined;
                            if(mirroredObj) {
                                mirroredObj.isClosed = true;
                                mirroredObj.points.pop();
                                Object.assign(mirroredObj, calculatePolygonBounds(mirroredObj.points));
                            }
                        }
                    }));
                    setInteraction({ mode: 'idle' });
                    setActiveTool('select');
                 } else { 
                    // Confirm the current floating point and add a NEW floating point
                    // Default handles to be collinear with anchor for straight lines
                    const newVertex: PolygonVertex = { anchor: point, handle1: point, handle2: point };
                    const updatedObject = produce(currentObject, draft => { draft.points.push(newVertex); });
                    
                    setAppState(produce(draft => {
                        const layer = draft.layers.find(l => l.id === draft.activeLayerId);
                        const obj = layer?.objects.find(o => o.id === currentObject.id) as PolygonObject | undefined;
                        if(obj) {
                            obj.points.push(newVertex);
                            Object.assign(obj, calculatePolygonBounds(obj.points));
                        }

                        if(mirroredObjectId) {
                            const mirroredObj = layer?.objects.find(o => o.id === mirroredObjectId) as PolygonObject | undefined;
                            const mirroredVertex = applyMirrorToObject({ ...newVertex, type: 'polygon', points: [newVertex] } as any, mirrorMode, mirrorGap, contentWidth, contentHeight) as PolygonObject;
                            if(mirroredObj && mirroredVertex) {
                                mirroredObj.points.push(mirroredVertex.points[0]);
                                Object.assign(mirroredObj, calculatePolygonBounds(mirroredObj.points));
                            }
                        }
                    }));
                    setInteraction({ mode: 'drawing_polygon', object: updatedObject, vertexIndex: updatedObject.points.length - 1, mirroredObjectId });
                 }
            } else { 
                // Initial Click: Create polygon with a start point AND a floating point
                const startVertex: PolygonVertex = { anchor: point, handle1: point, handle2: point };
                const floatVertex: PolygonVertex = { anchor: point, handle1: point, handle2: point };
                
                const newObject: PolygonObject = {
                    id: String(Date.now()), type: 'polygon',
                    points: [startVertex, floatVertex], isClosed: false,
                    x: point[0], y: point[1], width: 0, height: 0,
                    rotation: 0, skewX: 0, skewY: 0,
                    ...toolSettings
                } as PolygonObject;
                
                let mirroredObjectId: string | undefined;
                const objectsToAdd: VectorObject[] = [newObject];
                if (mirrorMode !== 'off') {
                    const mirroredObject = applyMirrorToObject(newObject, mirrorMode, mirrorGap, contentWidth, contentHeight);
                    mirroredObject.id = `mirror-${newObject.id}`;
                    mirroredObjectId = mirroredObject.id;
                    objectsToAdd.push(mirroredObject);
                }

                handleUpdateActiveLayer(l => {
                    l.objects.push(...objectsToAdd);
                    updateLayerPattern(l, { patternType: 'none' });
                });
                setSelectedObjectInfo({ layerId: activeLayerId!, objectIds: objectsToAdd.map(o => o.id) });
                setInteraction({ mode: 'drawing_polygon', object: newObject, vertexIndex: 1, mirroredObjectId });
            }
        } else if (activeTool === 'text') {
            if (!activeLayerId) return;
            const defaultText = "Text";
            const { fontSize, fontFamily, fontWeight, lineHeight, letterSpacing } = toolSettings;
            if (fontFamily && googleFonts.includes(fontFamily)) {
                loadGoogleFonts(new Set([fontFamily]));
            }
            const { width, height } = measureText(defaultText, fontSize!, fontFamily!, fontWeight!, lineHeight ?? 1.2, letterSpacing ?? 0);
            const newObject: TextObject = {
                ...toolSettings,
                id: String(Date.now()), type: 'text',
                x: point[0], y: point[1], width, height,
                rotation: 0, skewX: 0, skewY: 0, 
                text: defaultText,
            } as TextObject;

            const objectsToAdd: VectorObject[] = [newObject];
            if (mirrorMode !== 'off') {
                const mirroredObject = applyMirrorToObject(newObject, mirrorMode, mirrorGap, contentWidth, contentHeight);
                mirroredObject.id = `mirror-${newObject.id}`;
                objectsToAdd.push(mirroredObject);
            }

            handleUpdateActiveLayer(layer => {
                layer.objects.push(...objectsToAdd);
                updateLayerPattern(layer, { patternType: 'none' });
            });
            setSelectedObjectInfo({ layerId: activeLayerId, objectIds: [newObject.id] });
            setInteraction({ mode: 'editing_text', layerId: activeLayerId, objectId: newObject.id });
            setActiveTool('select');
        } else if (activeTool === 'pattern-brush' || activeTool === 'flow-guide') {
            if (!activeLayerId) return;
            const mirroredStrokeId = mirrorMode !== 'off' ? `mirror-stroke-${Date.now()}` : undefined;
            setInteraction({ mode: 'drawing_pattern_brush', points: [point], mirroredStrokeId });
        } else if (activeTool === 'path' || activeTool === 'line' || activeTool === 'shape' || activeTool === 'measure') {
            if (!activeLayerId) return;
            
            const mirroredObjectId = mirrorMode !== 'off' ? `mirror-${Date.now()}` : undefined;
            
            if (activeTool === 'measure' && hitInfo?.type === 'measure_segment') {
                const { p1, p2 } = hitInfo;
                // Calculate offset vector (perpendicular)
                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const len = Math.sqrt(dx * dx + dy * dy);
                const offset = 30;
                let offX = 0, offY = 0;
                if (len > 0) {
                    offX = (-dy / len) * offset;
                    offY = (dx / len) * offset;
                }
                
                const x1 = p1[0] + offX;
                const y1 = p1[1] + offY;
                const x2 = p2[0] + offX;
                const y2 = p2[1] + offY;

                const newObject: MeasurementObject = {
                    id: String(Date.now()),
                    type: 'measurement',
                    measurementType: 'distance',
                    referenceId: hitInfo.objectId,
                    x1, y1, x2, y2,
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1),
                    rotation: 0, skewX: 0, skewY: 0,
                    fill: 'none',
                    stroke: '#FACC15',
                    strokeWidth: 1,
                    opacity: 1, fillOpacity: 1, strokeOpacity: 1,
                    blendMode: 'normal',
                    showLength: true,
                    showAngle: false,
                    fontSize: 14,
                    fontFamily: 'monospace',
                    fontWeight: 'normal',
                    textColor: '#000000',
                    measurementOffset: 20
                };

                const objectsToAdd: VectorObject[] = [newObject];
                if (mirrorMode !== 'off') {
                    const mirroredObject = applyMirrorToObject(newObject, mirrorMode, mirrorGap, contentWidth, contentHeight);
                    mirroredObject.id = `mirror-${newObject.id}`;
                    objectsToAdd.push(mirroredObject);
                }

                handleUpdateActiveLayer(l => {
                    l.objects.push(...objectsToAdd);
                });
                setSelectedObjectInfo({ layerId: activeLayerId, objectIds: objectsToAdd.map(o => o.id) });
                setActiveTool('select');
                return;
            }

            if (activeTool === 'measure' && hitInfo?.type === 'object') {
                // If we clicked directly on an object while in measure mode, we prepare to measure IT
                // But only if we don't drag. We'll handle the "creation" in MouseUp if it's a click.
                // Here we just start a "drawing_measurement" to allow dragging freely if the user wants custom lines.
                // If they click (start==end), we convert to smart measure in MouseUp.
                const newObject: MeasurementObject = {
                    id: String(Date.now()),
                    type: 'measurement',
                    measurementType: 'distance',
                    x1: point[0], y1: point[1], x2: point[0], y2: point[1],
                    x: point[0], y: point[1], width: 0, height: 0,
                    rotation: 0, skewX: 0, skewY: 0,
                    fill: 'none',
                    stroke: '#FACC15', 
                    strokeWidth: 1,
                    opacity: 1, fillOpacity: 1, strokeOpacity: 1,
                    blendMode: 'normal',
                    showLength: true,
                    showAngle: false,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 'normal',
                    textColor: '#000000',
                    measurementOffset: 20
                };
                setInteraction({ mode: 'drawing_measurement', object: newObject, mirroredObjectId, startPoint: point });
                return;
            }

            if (activeTool === 'path') {
                const newObject: PathObject = {
                    ...toolSettings,
                    id: String(Date.now()), type: 'path',
                    points: [point],
                    x: point[0], y: point[1], width: 0, height: 0,
                    rotation: 0, skewX: 0, skewY: 0, 
                    smoothing: 0,
                } as PathObject;
                setInteraction({ mode: 'drawing_path', object: newObject, mirroredObjectId });
            } else if (activeTool === 'line') {
                 const newObject: LineObject = {
                    ...toolSettings,
                    id: String(Date.now()), type: 'line',
                    x1: point[0], y1: point[1], x2: point[0], y2: point[1],
                    x: point[0], y: point[1], width: 0, height: 0,
                    rotation: 0, skewX: 0, skewY: 0, 
                } as LineObject;
                setInteraction({ mode: 'drawing_line', object: newObject, mirroredObjectId });
            } else if (activeTool === 'shape') {
                const newObject: ShapeObject = {
                    ...toolSettings,
                    id: String(Date.now()), type: 'shape',
                    x: point[0], y: point[1], width: 0, height: 0, rotation: 0, skewX: 0, skewY: 0,
                    shapeType: activeShapeType,
                } as ShapeObject;
                setInteraction({ mode: 'drawing_object', object: newObject, startPoint: point, mirroredObjectId });
            } else if (activeTool === 'measure') {
                const newObject: MeasurementObject = {
                    id: String(Date.now()),
                    type: 'measurement',
                    measurementType: 'distance',
                    x1: point[0], y1: point[1], x2: point[0], y2: point[1],
                    x: point[0], y: point[1], width: 0, height: 0,
                    rotation: 0, skewX: 0, skewY: 0,
                    fill: 'none',
                    stroke: '#FACC15', // A good yellow for measurements
                    strokeWidth: 1,
                    opacity: 1,
                    fillOpacity: 1,
                    strokeOpacity: 1,
                    blendMode: 'normal',
                    showLength: true,
                    showAngle: false,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 'normal',
                    textColor: '#000000',
                    measurementOffset: 20
                };
                setInteraction({ mode: 'drawing_measurement', object: newObject, mirroredObjectId, startPoint: point });
            }
        } else if (activeTool === 'image') {
            if (!activeLayerId) return;

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files[0]) {
                    handleInitiateImport(target.files[0], 'image', point);
                    setActiveTool('select');
                }
            };
            input.click();
        }
    }
  }, [layers, activeLayer, activeLayerId, activeTool, editingMode, handleUpdateActiveLayer, interaction, handleUpdateSelectedObjects, contentWidth, contentHeight, activeShapeType, selectedObjectInfo, selectedObjects, mirrorMode, mirrorGap, setAppState, setActiveTool, updateLayerPattern, canvasConfig, setSelectedObjectInfo, setInteraction, loadGoogleFonts, toolSettings, handleInitiateImport, commitHistory]);

    /**
     * Handles the mouse move event on the canvas.
     * Updates state for drag operations like moving objects, resizing, drawing, etc.
     * Updates temporary objects or guides during continuous interactions.
     */
    const handleCanvasMouseMove = useCallback((point: Point | null, shiftKey: boolean) => {
    if (!point) return;

    // FIX: Handle dragging new or existing guides
    if (interaction.mode === 'dragging_new_guide' || interaction.mode === 'moving_guide') {
        setInteraction(produce(draft => {
            if (draft.mode === 'dragging_new_guide' || draft.mode === 'moving_guide') {
                draft.guide.position = draft.guide.orientation === 'horizontal' ? point[1] : point[0];
            }
        }));
        return;
    }

    if (interaction.mode === 'measuring') {
        setInteraction(produce(draft => {
            if (draft.mode === 'measuring') {
                draft.currentPoint = point;
            }
        }));
        return;
    }

    if (interaction.mode === 'marquee_selection') {
        setInteraction(produce(draft => {
            if (draft.mode === 'marquee_selection') {
                draft.currentPoint = point;
            }
        }));
        return;
    }

    if (interaction.mode === 'drawing_pattern_brush') {
        setInteraction(produce(draft => {
            if (draft.mode === 'drawing_pattern_brush') {
                draft.points.push(point);
            }
        }));
        return;
    }

    if (interaction.mode === 'drawing_path') {
        setInteraction(produce(draft => {
            if (draft.mode === 'drawing_path') {
                draft.object.points.push(point);
            }
        }));
        return;
    }

    if (interaction.mode === 'drawing_line') {
        setInteraction(produce(draft => {
            if (draft.mode === 'drawing_line') {
                draft.object.x2 = point[0];
                draft.object.y2 = point[1];
                draft.object.x = Math.min(draft.object.x1, point[0]);
                draft.object.y = Math.min(draft.object.y1, point[1]);
                draft.object.width = Math.abs(point[0] - draft.object.x1);
                draft.object.height = Math.abs(point[1] - draft.object.y1);
            }
        }));
        return;
    }

    if (interaction.mode === 'drawing_measurement') {
        setInteraction(produce(draft => {
            if (draft.mode === 'drawing_measurement') {
                draft.object.x2 = point[0];
                draft.object.y2 = point[1];
                const minX = Math.min(draft.object.x1, point[0]);
                const minY = Math.min(draft.object.y1, point[1]);
                const w = Math.abs(point[0] - draft.object.x1);
                const h = Math.abs(point[1] - draft.object.y1);
                draft.object.x = minX;
                draft.object.y = minY;
                draft.object.width = w;
                draft.object.height = h;
            }
        }));
        return;
    }

    if (interaction.mode === 'drawing_object') {
        setInteraction(produce(draft => {
            if (draft.mode === 'drawing_object') {
                const { startPoint } = draft;
                let currentX = point[0];
                let currentY = point[1];

                if (shiftKey) {
                    const dx = currentX - startPoint[0];
                    const dy = currentY - startPoint[1];
                    const size = Math.max(Math.abs(dx), Math.abs(dy));
                    
                    // Preserve direction relative to start point
                    currentX = startPoint[0] + (dx >= 0 ? size : -size);
                    currentY = startPoint[1] + (dy >= 0 ? size : -size);
                }

                const newWidth = Math.abs(currentX - startPoint[0]);
                const newHeight = Math.abs(currentY - startPoint[1]);
                const newX = Math.min(currentX, startPoint[0]);
                const newY = Math.min(currentY, startPoint[1]);
                
                draft.object.x = newX;
                draft.object.y = newY;
                draft.object.width = newWidth;
                draft.object.height = newHeight;
            }
        }));
        return;
    }
    
    const continuousActions: InteractionState['mode'][] = [
        'moving_layer', 'rotating_layer', 'resizing_layer',
        'moving_clip_path', 'drawing', 'moving_anchor', 'moving_handle',
        'moving_object', 'resizing_object', 'rotating_object', 'resizing_group', 'rotating_group',
        'moving_polygon_anchor', 'moving_polygon_handle', 'drawing_polygon'
    ];
    
    const isContinuous = continuousActions.includes(interaction.mode);

    setAppState(produce((draft: AppState) => {
        const layer = draft.layers.find(l => l.id === draft.activeLayerId);
        if (!layer) return;

        switch (interaction.mode) {
            case 'moving_layer': {
                const { startPoint, startOffsetX, startOffsetY } = interaction;
                const dx = point[0] - startPoint[0];
                const dy = point[1] - startPoint[1];
                layer.offsetX = startOffsetX + dx;
                layer.offsetY = startOffsetY + dy;
                break;
            }
            case 'rotating_layer': {
                const { center, startAngle, startLayer } = interaction;
                const currentAngle = Math.atan2(point[1] - center[1], point[0] - center[0]);
                const angleDiffRad = currentAngle - startAngle;
                layer.rotation = startLayer.rotation + (angleDiffRad * 180 / Math.PI);
                break;
            }
            case 'resizing_layer': {
                const { startLayer, handle, pivotPoint } = interaction;

                const startHandlePosUntransformed = getLayerHandlePosition(handle, contentWidth, contentHeight);

                const pivotX = contentWidth / 2;
                const pivotY = contentHeight / 2;
                const rad = startLayer.rotation * Math.PI / 180;

                let startHandlePosRel = sub(startHandlePosUntransformed, [pivotX, pivotY]);
                startHandlePosRel = scale(startHandlePosRel, startLayer.scale);
                startHandlePosRel = rotatePoint(startHandlePosRel, [0, 0], rad);
                const startHandlePos = add(startHandlePosRel, [pivotX + startLayer.offsetX, pivotY + startLayer.offsetY]);

                const vStart = sub(startHandlePos, pivotPoint);
                const vMouse = sub(point, pivotPoint);

                const startLenSq = dot(vStart, vStart);
                let scaleRatio = 1;
                if (startLenSq > 1e-6) {
                    scaleRatio = dot(vMouse, vStart) / startLenSq;
                }

                const newScale = Math.max(0.01, startLayer.scale * scaleRatio);

                const oppositeHandleMap: Record<ResizeHandle, ResizeHandle> = { 'top-left': 'bottom-right', 'top-right': 'bottom-left', 'bottom-left': 'top-right', 'bottom-right': 'top-left', 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left', 'start': 'end', 'end': 'start' };
                const untransformedPivot = getLayerHandlePosition(oppositeHandleMap[handle], contentWidth, contentHeight);
                const centerUntransformed: Point = [contentWidth / 2, contentHeight / 2];

                const pivotToCenter_local = sub(centerUntransformed, untransformedPivot);

                const pivotToCenterStart_world = rotatePoint(scale(pivotToCenter_local, startLayer.scale), [0, 0], rad);
                const pivotToCenterEnd_world = rotatePoint(scale(pivotToCenter_local, newScale), [0, 0], rad);

                const centerDelta = sub(pivotToCenterEnd_world, pivotToCenterStart_world);

                layer.scale = newScale;
                layer.offsetX = startLayer.offsetX + centerDelta[0];
                layer.offsetY = startLayer.offsetY + centerDelta[1];
                
                break;
            }
            case 'moving_clip_path': {
                const { startPoint, startClipPoints } = interaction;
                const dx = point[0] - startPoint[0];
                const dy = point[1] - startPoint[1];
                layer.clipPolygonPoints = startClipPoints.map(vertex => ({
                    anchor: [vertex.anchor[0] + dx, vertex.anchor[1] + dy],
                    handle1: [vertex.handle1[0] + dx, vertex.handle1[1] + dy],
                    handle2: [vertex.handle2[0] + dx, vertex.handle2[1] + dy],
                }));
                break;
            }
            case 'drawing': {
                if (editingMode === 'clip') {
                     const localPoint = transformWorldPointToLayerLocal(point, layer, draft.canvasConfig);
                     const vertex = layer.clipPolygonPoints[interaction.vertexIndex];
                     if (vertex) {
                         vertex.anchor = localPoint;
                         vertex.handle1 = localPoint;
                         vertex.handle2 = localPoint;
                     }
                }
                break;
            }
            case 'moving_anchor': case 'moving_handle': {
                const updater = produce((polyPoints: PolygonVertex[]) => {
                    switch (interaction.mode) {
                        case 'moving_anchor': {
                            const { vertexIndex, startPoint, startVertex } = interaction; const dx = point[0] - startPoint[0]; const dy = point[1] - startPoint[1];
                            polyPoints[vertexIndex] = { anchor: [startVertex.anchor[0] + dx, startVertex.anchor[1] + dy], handle1: [startVertex.handle1[0] + dx, startVertex.handle1[1] + dy], handle2: [startVertex.handle2[0] + dx, startVertex.handle2[1] + dy], };
                            break;
                        }
                        case 'moving_handle': {
                            const { vertexIndex, handleKey } = interaction; const vertex = polyPoints[vertexIndex]; if (!vertex) return;
                            const anchor = vertex.anchor; const newHandlePos: Point = point; const newOtherHandlePos: Point = [anchor[0] - (newHandlePos[0] - anchor[0]), anchor[1] - (newHandlePos[1] - anchor[1])];
                            if (handleKey === 'handle1') { vertex.handle1 = newHandlePos; vertex.handle2 = newOtherHandlePos; } else { vertex.handle2 = newHandlePos; vertex.handle1 = newOtherHandlePos; }
                            break;
                        }
                    }
                });
                layer.clipPolygonPoints = updater(layer.clipPolygonPoints);
                break;
            }
            case 'drawing_polygon': {
                const { mirroredObjectId, object } = interaction;
                if (!selectedObjectInfo || !selectedObjectInfo.objectIds.includes(object.id)) return;
                
                const obj = layer.objects.find(o => o.id === object.id) as PolygonObject | undefined;
                if (!obj) return;
                
                // When drawing a polygon, move the active vertex (anchor) to the mouse position.
                // Reset handles to be collinear with anchor to ensure straight lines by default.
                const vertex = obj.points[interaction.vertexIndex]; 
                if (!vertex) return;
                
                vertex.anchor = point;
                vertex.handle1 = point;
                vertex.handle2 = point;
                
                // Update bounds
                Object.assign(obj, calculatePolygonBounds(obj.points));
                
                if (mirroredObjectId) {
                    const mirroredObj = layer.objects.find(o => o.id === mirroredObjectId) as PolygonObject | undefined;
                    if (mirroredObj) {
                        const updatedMirrored = applyMirrorToObject(obj, mirrorMode, mirrorGap, contentWidth, contentHeight);
                        if (updatedMirrored.type === 'polygon') {
                            mirroredObj.points = updatedMirrored.points;
                            Object.assign(mirroredObj, calculatePolygonBounds(mirroredObj.points));
                        }
                    }
                }
                break;
            }
            case 'moving_polygon_anchor': {
                const { layerId, objectId, vertexIndex, startPoint, startVertex } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                const object = objectLayer?.objects.find(o => o.id === objectId) as PolygonObject | undefined;
                if (!object) return;
                const dx = point[0] - startPoint[0]; const dy = point[1] - startPoint[1];
                object.points[vertexIndex] = { anchor: [startVertex.anchor[0] + dx, startVertex.anchor[1] + dy], handle1: [startVertex.handle1[0] + dx, startVertex.handle1[1] + dy], handle2: [startVertex.handle2[0] + dx, startVertex.handle2[1] + dy], };
                Object.assign(object, calculatePolygonBounds(object.points));
                break;
            }
            case 'moving_polygon_handle': {
                const { layerId, objectId, vertexIndex, handleKey } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                const object = objectLayer?.objects.find(o => o.id === objectId) as PolygonObject | undefined;
                if (!object) return;
                const vertex = object.points[vertexIndex]; if (!vertex) return;
                
                const anchor = vertex.anchor; 
                const newHandlePos: Point = point; 
                // Enforce symmetry for smooth curves when dragging handles (which is the expected behavior when "pulling out" via Alt)
                const newOtherHandlePos: Point = [anchor[0] - (newHandlePos[0] - anchor[0]), anchor[1] - (newHandlePos[1] - anchor[1])];
                
                if (handleKey === 'handle1') { vertex.handle1 = newHandlePos; vertex.handle2 = newOtherHandlePos; } 
                else { vertex.handle2 = newHandlePos; vertex.handle1 = newOtherHandlePos; }
                break;
            }
            case 'moving_object': {
                const { layerId, startPoint, startObjects } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                if (!objectLayer) return;
                
                const localStartPoint = transformWorldPointToLayerLocal(startPoint, objectLayer, draft.canvasConfig);
                const localCurrentPoint = transformWorldPointToLayerLocal(point, objectLayer, draft.canvasConfig);

                // Calculate initial delta
                let dx = localCurrentPoint[0] - localStartPoint[0];
                let dy = localCurrentPoint[1] - localStartPoint[1];

                const movingObjectIds = new Set(startObjects.map(o => o.id));
                
                // --- Snapping Logic ---
                if ((snapSettings.grid || snapSettings.smart) && !shiftKey) {
                    const otherObjects = objectLayer.objects.filter(o => !movingObjectIds.has(o.id));
                    // FIX: Use startObjects for accurate bounds calculation relative to start position
                    const selectionBounds = calculateGroupBounds(startObjects);
                    
                    // Calculate the "proposed" bounds after applying the raw delta
                    const proposedBounds = {
                        x: selectionBounds.x + dx,
                        y: selectionBounds.y + dy,
                        width: selectionBounds.width,
                        height: selectionBounds.height
                    };

                    // FIX: Pass the missing `guides` argument to calculateSnapping.
                    const snapResult = calculateSnapping(
                        [proposedBounds.x, proposedBounds.y], // Use top-left for simple grid snap logic inside calculateSnapping
                        proposedBounds,
                        otherObjects,
                        draft.canvasConfig,
                        snapSettings,
                        draft.guides
                    );

                    // Apply the additional snap adjustment to our delta
                    dx += snapResult.dx;
                    dy += snapResult.dy;
                    
                    // Update guides for visualization
                    setActiveGuides(snapResult.guides);
                } else {
                    setActiveGuides([]);
                }
                // ----------------------

                objectLayer.objects.forEach(object => {
                    if (!movingObjectIds.has(object.id)) return;
                    const startObject = startObjects.find(o => o.id === object.id);
                    if (!startObject) return;

                    if (object.type === 'text' || object.type === 'shape' || object.type === 'generic-path' || object.type === 'flow-guide' || object.type === 'path-group' || object.type === 'image' || object.type === 'group') {
                        object.x = (startObject as any).x + dx;
                        object.y = (startObject as any).y + dy;
                    } else if (object.type === 'polygon') {
                        const startPoly = startObject as PolygonObject;
                        object.points = startPoly.points.map(p => ({
                            anchor: [p.anchor[0] + dx, p.anchor[1] + dy],
                            handle1: [p.handle1[0] + dx, p.handle1[1] + dy],
                            handle2: [p.handle2[0] + dx, p.handle2[1] + dy],
                        }));
                        object.x = startPoly.x + dx;
                        object.y = startPoly.y + dy;
                    } else if (object.type === 'path') {
                        const startPath = startObject as PathObject;
                        object.points = startPath.points.map(p => [p[0] + dx, p[1] + dy]);
                        object.x = startPath.x + dx;
                        object.y = startPath.y + dy;
                    } else if (object.type === 'line') {
                        const startLine = startObject as LineObject;
                        object.x1 = startLine.x1 + dx;
                        object.y1 = startLine.y1 + dy;
                        object.x2 = startLine.x2 + dx;
                        object.y2 = startLine.y2 + dy;
                        object.x = startLine.x + dx;
                        object.y = startLine.y + dy;
                    } else if (object.type === 'measurement') {
                        const startMeasure = startObject as MeasurementObject;
                        const measureObj = object as unknown as MeasurementObject;
                        measureObj.x1 = startMeasure.x1 + dx;
                        measureObj.y1 = startMeasure.y1 + dy;
                        measureObj.x2 = startMeasure.x2 + dx;
                        measureObj.y2 = startMeasure.y2 + dy;
                        measureObj.x = startMeasure.x + dx;
                        measureObj.y = startMeasure.y + dy;
                    }
                });
                break;
            }
            case 'rotating_object': {
                const { layerId, objectId, startObject, center, startAngle, mirroredObjectId, startMirroredObject } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                const object = objectLayer?.objects.find(o => o.id === objectId);
                if (!object) return;

                const currentAngle = Math.atan2(point[1] - center[1], point[0] - center[0]);
                const angleDiffRad = currentAngle - startAngle;
                const angleDiffDeg = angleDiffRad * 180 / Math.PI;

                object.rotation = startObject.rotation + angleDiffDeg;
                
                if (mirroredObjectId && startMirroredObject) {
                    const mirroredObject = objectLayer?.objects.find(o => o.id === mirroredObjectId);
                    if (mirroredObject) {
                        mirroredObject.rotation = startMirroredObject.rotation - angleDiffDeg;
                    }
                }
                break;
            }
            case 'rotating_group': {
                const { layerId, startObjects, groupCenter, startAngle } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                if (!objectLayer) break;

                const currentAngle = Math.atan2(point[1] - groupCenter[1], point[0] - groupCenter[0]);
                const angleDiffRad = currentAngle - startAngle;
                const angleDiffDeg = angleDiffRad * 180 / Math.PI;

                startObjects.forEach(startObject => {
                    const object = objectLayer.objects.find(o => o.id === startObject.id);
                    if (!object) return;

                    const startObjectCenter: Point = [startObject.x + startObject.width / 2, startObject.y + startObject.height / 2];
                    const newObjectCenter = rotatePoint(startObjectCenter, groupCenter, angleDiffRad);
                    const dx = newObjectCenter[0] - startObjectCenter[0];
                    const dy = newObjectCenter[1] - startObjectCenter[1];

                    object.rotation = startObject.rotation + angleDiffDeg;

                    if (object.type === 'text' || object.type === 'shape' || object.type === 'generic-path' || object.type === 'flow-guide' || object.type === 'path-group' || object.type === 'image') {
                        object.x = startObject.x + dx;
                        object.y = startObject.y + dy;
                    } else if (object.type === 'polygon' && startObject.type === 'polygon') {
                        object.points = startObject.points.map(p => ({
                            anchor: [p.anchor[0] + dx, p.anchor[1] + dy],
                            handle1: [p.handle1[0] + dx, p.handle1[1] + dy],
                            handle2: [p.handle2[0] + dx, p.handle2[1] + dy],
                        }));
                        Object.assign(object, calculatePolygonBounds(object.points));
                    } else if (object.type === 'path' && startObject.type === 'path') {
                        object.points = startObject.points.map(p => [p[0] + dx, p[1] + dy]);
                        Object.assign(object, calculatePathBounds(object.points));
                    } else if (object.type === 'line' && startObject.type === 'line') {
                        // rotate start/end points around group center
                        const p1 = rotatePoint([startObject.x1, startObject.y1], groupCenter, angleDiffRad);
                        const p2 = rotatePoint([startObject.x2, startObject.y2], groupCenter, angleDiffRad);
                        object.x1 = p1[0]; object.y1 = p1[1];
                        object.x2 = p2[0]; object.y2 = p2[1];
                        
                        // Recalculate bounds from rotated points
                        const minX = Math.min(p1[0], p2[0]);
                        const maxX = Math.max(p1[0], p2[0]);
                        const minY = Math.min(p1[1], p2[1]);
                        const maxY = Math.max(p1[1], p2[1]);
                        object.x = minX; object.y = minY;
                        object.width = maxX - minX; object.height = maxY - minY;
                    } else if (object.type === 'measurement' && startObject.type === 'measurement') {
                        const p1 = rotatePoint([startObject.x1, startObject.y1], groupCenter, angleDiffRad);
                        const p2 = rotatePoint([startObject.x2, startObject.y2], groupCenter, angleDiffRad);
                        const mObj = object as unknown as MeasurementObject;
                        mObj.x1 = p1[0]; mObj.y1 = p1[1];
                        mObj.x2 = p2[0]; mObj.y2 = p2[1];
                        
                        const minX = Math.min(p1[0], p2[0]);
                        const maxX = Math.max(p1[0], p2[0]);
                        const minY = Math.min(p1[1], p2[1]);
                        const maxY = Math.max(p1[1], p2[1]);
                        object.x = minX; object.y = minY;
                        object.width = maxX - minX; object.height = maxY - minY;
                    }
                });
                
                if (selectedObjectInfo && selectedObjectInfo.objectIds.length === 1) {
                    const groupObject = objectLayer.objects.find(o => o.id === selectedObjectInfo.objectIds[0]);
                    if (groupObject && groupObject.type === 'group') {
                        const childObjects = (groupObject as GroupObject).objectIds.map(id => objectLayer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];
                        const newBounds = calculateGroupBounds(childObjects);
                        groupObject.x = newBounds.x;
                        groupObject.y = newBounds.y;
                        groupObject.width = newBounds.width;
                        groupObject.height = newBounds.height;
                    }
                }
                break;
            }
            case 'resizing_object': {
                const { layerId, objectId, startObject, handle, mirroredObjectId } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                const object = objectLayer?.objects.find(o => o.id === objectId);
                if (!object) return;

                const cx = startObject.x + startObject.width / 2;
                const cy = startObject.y + startObject.height / 2;
                const startCenter: Point = [cx, cy];

                const angleRad = -startObject.rotation * (Math.PI / 180);
                const localMouse = rotatePoint(point, startCenter, angleRad);

                let newX = startObject.x;
                let newY = startObject.y;
                let newW = startObject.width;
                let newH = startObject.height;

                if (handle.includes('left')) {
                    const delta = localMouse[0] - newX;
                    newX += delta;
                    newW -= delta;
                } else if (handle.includes('right')) {
                    newW = localMouse[0] - newX;
                }

                if (handle.includes('top')) {
                    const delta = localMouse[1] - newY;
                    newY += delta;
                    newH -= delta;
                } else if (handle.includes('bottom')) {
                    newH = localMouse[1] - newY;
                }
                
                if (shiftKey || startObject.type === 'text') {
                    const aspectRatio = (startObject.width > 1e-6 && startObject.height > 1e-6) ? startObject.width / startObject.height : 1;
                    const isCorner = (handle.includes('top') || handle.includes('bottom')) && (handle.includes('left') || handle.includes('right'));
                    
                    if (isCorner) {
                        const deltaW = newW - startObject.width;
                        const deltaH = newH - startObject.height;

                        if (Math.abs(deltaW * startObject.height) > Math.abs(deltaH * startObject.width)) {
                            const oldH = newH;
                            newH = newW / aspectRatio;
                            if (handle.includes('top')) {
                                newY += oldH - newH;
                            }
                        } else {
                            const oldW = newW;
                            newW = newH * aspectRatio;
                            if (handle.includes('left')) {
                                newX += oldW - newW;
                            }
                        }
                    } else { // Side handle: scale from center
                        const startCenterX = startObject.x + startObject.width / 2;
                        const startCenterY = startObject.y + startObject.height / 2;
                        
                        if (handle === 'right' || handle === 'left') {
                            const scale = startObject.width > 1e-6 ? newW / startObject.width : 1;
                            newH = startObject.height * scale;
                        } else { // top or bottom
                            const scale = startObject.height > 1e-6 ? newH / startObject.height : 1;
                            newW = startObject.width * scale;
                        }
                        
                        newX = startCenterX - newW / 2;
                        newY = startCenterY - newH / 2;
                    }
                }

                if (newW < 0) { newX += newW; newW = Math.abs(newW); }
                if (newH < 0) { newY += newH; newH = Math.abs(newH); }

                const newCx = newX + newW / 2;
                const newCy = newY + newH / 2;

                const dx = newCx - cx;
                const dy = newCy - cy;

                const cos = Math.cos(-angleRad);
                const sin = Math.sin(-angleRad);
                const worldDx = dx * cos - dy * sin;
                const worldDy = dx * sin + dy * cos;

                const finalCx = cx + worldDx;
                const finalCy = cy + worldDy;

                object.width = newW;
                object.height = newH;
                object.x = finalCx - newW / 2;
                object.y = finalCy - newH / 2;

                const scaleX = startObject.width === 0 ? 1 : newW / startObject.width;
                const scaleY = startObject.height === 0 ? 1 : newH / startObject.height;

                const worldRotRad = -angleRad;

                const transformPointResize = (p: Point): Point => {
                    const pRel = sub(p, startCenter);
                    const pLocal = rotatePoint(pRel, [0,0], angleRad);
                    
                    const u = startObject.width > 1e-6 ? (pLocal[0] + startCenter[0] - startObject.x) / startObject.width : 0.5;
                    const v = startObject.height > 1e-6 ? (pLocal[1] + startCenter[1] - startObject.y) / startObject.height : 0.5;
                    
                    const newPxLocal = newX + u * newW;
                    const newPyLocal = newY + v * newH;
                    
                    const newPxRel = newPxLocal - newCx;
                    const newPyRel = newPyLocal - newCy;
                    
                    const pBack = rotatePoint([newPxRel, newPyRel], [0,0], worldRotRad);
                    
                    return [pBack[0] + finalCx, pBack[1] + finalCy];
                };

                if (object.type === 'polygon') {
                    const polyStart = startObject as PolygonObject;
                    object.points = polyStart.points.map(v => ({
                        anchor: transformPointResize(v.anchor),
                        handle1: transformPointResize(v.handle1),
                        handle2: transformPointResize(v.handle2),
                    }));
                } else if (object.type === 'path' || object.type === 'flow-guide') {
                    const pathStart = startObject as PathObject;
                    object.points = pathStart.points.map(p => transformPointResize(p));
                } else if (object.type === 'line') {
                    const lineStart = startObject as LineObject;
                    const p1 = transformPointResize([lineStart.x1, lineStart.y1]);
                    const p2 = transformPointResize([lineStart.x2, lineStart.y2]);
                    object.x1 = p1[0]; object.y1 = p1[1];
                    object.x2 = p2[0]; object.y2 = p2[1];
                } else if (object.type === 'measurement') {
                    const mStart = startObject as MeasurementObject;
                    const p1 = transformPointResize([mStart.x1, mStart.y1]);
                    const p2 = transformPointResize([mStart.x2, mStart.y2]);
                    const mObj = object as unknown as MeasurementObject;
                    mObj.x1 = p1[0]; mObj.y1 = p1[1];
                    mObj.x2 = p2[0]; mObj.y2 = p2[1];
                } else if (object.type === 'text') {
                    const startText = startObject as TextObject;
                    // Use scaleY as height is the primary dimension for text size
                    (object as TextObject).fontSize = startText.fontSize * scaleY;
                }

                if (mirroredObjectId && mirrorMode !== 'off') {
                    const mirroredObject = objectLayer.objects.find(o => o.id === mirroredObjectId);
                    if (mirroredObject) {
                        const updatedMirrored = applyMirrorToObject(object, mirrorMode, mirrorGap, contentWidth, contentHeight);
                        const originalMirrorId = mirroredObject.id;
                        Object.assign(mirroredObject, updatedMirrored);
                        mirroredObject.id = originalMirrorId;
                    }
                }
                break;
            }
            case 'resizing_group': {
                const { layerId, startObjects, handle, startGroupBounds, pivotPoint } = interaction;
                const objectLayer = draft.layers.find(l => l.id === layerId);
                if (!objectLayer) return;

                let newX = startGroupBounds.x;
                let newY = startGroupBounds.y;
                let newW = startGroupBounds.width;
                let newH = startGroupBounds.height;

                if (handle.includes('left')) {
                    const delta = point[0] - newX;
                    newX += delta;
                    newW -= delta;
                } else if (handle.includes('right')) {
                    newW = point[0] - newX;
                }

                if (handle.includes('top')) {
                    const delta = point[1] - newY;
                    newY += delta;
                    newH -= delta;
                } else if (handle.includes('bottom')) {
                    newH = point[1] - newY;
                }

                if (shiftKey) {
                    const aspectRatio = (startGroupBounds.width > 1e-6 && startGroupBounds.height > 1e-6) ? startGroupBounds.width / startGroupBounds.height : 1;
                    const isCorner = (handle.includes('top') || handle.includes('bottom')) && (handle.includes('left') || handle.includes('right'));
                    
                    if (isCorner) {
                        const deltaW = newW - startGroupBounds.width;
                        const deltaH = newH - startGroupBounds.height;
                
                        if (Math.abs(deltaW * startGroupBounds.height) > Math.abs(deltaH * startGroupBounds.width)) {
                            const oldH = newH;
                            newH = newW / aspectRatio;
                            if (handle.includes('top')) {
                                newY += oldH - newH;
                            }
                        } else {
                            const oldW = newW;
                            newW = newH * aspectRatio;
                            if (handle.includes('left')) {
                                newX += oldW - newW;
                            }
                        }
                    } else { // Side handle: scale from center
                        const startCenterX = startGroupBounds.x + startGroupBounds.width / 2;
                        const startCenterY = startGroupBounds.y + startGroupBounds.height / 2;
                        
                        if (handle === 'right' || handle === 'left') {
                            const scale = startGroupBounds.width > 1e-6 ? newW / startGroupBounds.width : 1;
                            newH = startGroupBounds.height * scale;
                        } else { // top or bottom
                            const scale = startGroupBounds.height > 1e-6 ? newH / startGroupBounds.height : 1;
                            newW = startGroupBounds.width * scale;
                        }
                        
                        newX = startCenterX - newW / 2;
                        newY = startCenterY - newH / 2;
                    }
                }

                if (newW < 0) { newX += newW; newW = Math.abs(newW); }
                if (newH < 0) { newY += newH; newH = Math.abs(newH); }

                const scaleX = startGroupBounds.width === 0 ? 1 : newW / startGroupBounds.width;
                const scaleY = startGroupBounds.height === 0 ? 1 : newH / startGroupBounds.height;

                startObjects.forEach(startObj => {
                    const object = objectLayer.objects.find(o => o.id === startObj.id);
                    if (!object) return;

                    const startCx = startObj.x + startObj.width / 2;
                    const startCy = startObj.y + startObj.height / 2;
                    
                    const relCx = (startCx - startGroupBounds.x) * scaleX;
                    const relCy = (startCy - startGroupBounds.y) * scaleY;
                    
                    const newCx = newX + relCx;
                    const newCy = newY + relCy;

                    const newObjW = startObj.width * scaleX;
                    const newObjH = startObj.height * scaleY;

                    object.x = newCx - newObjW / 2;
                    object.y = newCy - newObjH / 2;
                    object.width = newObjW;
                    object.height = newObjH;

                    if (object.type === 'polygon') {
                        const polyStart = startObj as PolygonObject;
                        object.points = polyStart.points.map(v => ({
                            anchor: [newX + (v.anchor[0] - startGroupBounds.x) * scaleX, newY + (v.anchor[1] - startGroupBounds.y) * scaleY],
                            handle1: [newX + (v.handle1[0] - startGroupBounds.x) * scaleX, newY + (v.handle1[1] - startGroupBounds.y) * scaleY],
                            handle2: [newX + (v.handle2[0] - startGroupBounds.x) * scaleX, newY + (v.handle2[1] - startGroupBounds.y) * scaleY],
                        }));
                    } else if (object.type === 'path' || object.type === 'flow-guide') {
                        const pathStart = startObj as PathObject;
                        object.points = pathStart.points.map(p => [newX + (p[0] - startGroupBounds.x) * scaleX, newY + (p[1] - startGroupBounds.y) * scaleY]);
                    } else if (object.type === 'line') {
                        const lineStart = startObj as LineObject;
                        object.x1 = newX + (lineStart.x1 - startGroupBounds.x) * scaleX;
                        object.y1 = newY + (lineStart.y1 - startGroupBounds.y) * scaleY;
                        object.x2 = newX + (lineStart.x2 - startGroupBounds.x) * scaleX;
                        object.y2 = newY + (lineStart.y2 - startGroupBounds.y) * scaleY;
                    } else if (object.type === 'measurement') {
                        const mStart = startObj as MeasurementObject;
                        const mObj = object as unknown as MeasurementObject;
                        mObj.x1 = newX + (mStart.x1 - startGroupBounds.x) * scaleX;
                        mObj.y1 = newY + (mStart.y1 - startGroupBounds.y) * scaleY;
                        mObj.x2 = newX + (mStart.x2 - startGroupBounds.x) * scaleX;
                        mObj.y2 = newY + (mStart.y2 - startGroupBounds.y) * scaleY;
                    } else if (object.type === 'text') {
                        const textObj = object as TextObject;
                        const startText = startObj as TextObject;
                        const avgScale = (scaleX + scaleY) / 2;
                        textObj.fontSize = startText.fontSize * avgScale;
                    }
                });

                if (selectedObjectInfo && selectedObjectInfo.objectIds.length === 1) {
                    const groupObject = objectLayer.objects.find(o => o.id === selectedObjectInfo.objectIds[0]);
                    if (groupObject && groupObject.type === 'group') {
                        const childObjects = (groupObject as GroupObject).objectIds.map(id => objectLayer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];
                        const newBounds = calculateGroupBounds(childObjects);
                        groupObject.x = newBounds.x;
                        groupObject.y = newBounds.y;
                        groupObject.width = newBounds.width;
                        groupObject.height = newBounds.height;
                    }
                }
                break;
            }
        }
    }), { coalesce: isContinuous });
    }, [interaction, contentWidth, contentHeight, setAppState, snapSettings, setActiveGuides, activeTool]); // Added activeTool to dependencies

    /**
     * Handles mouse up event to end interactions.
     * Finalizes drawing, commits moves, and resets interaction state to idle.
     */
    const handleCanvasMouseUp = useCallback(() => {
        // Commit the history for any drag/continuous operation that just finished
        commitHistory();

        // FIX: Finalize guide creation or move.
        if (interaction.mode === 'dragging_new_guide') {
            setAppState(produce((draft: AppState) => {
                const { guide } = interaction;
                const pos = guide.position;
                let onCanvas = true;
                if (guide.orientation === 'horizontal' && (pos < 0 || pos > contentHeight)) {
                    onCanvas = false;
                } else if (guide.orientation === 'vertical' && (pos < 0 || pos > contentWidth)) {
                    onCanvas = false;
                }
                if(onCanvas) {
                    draft.guides.push(guide);
                }
            }));
            setInteraction({ mode: 'idle' });
            return;
        }
    
        if (interaction.mode === 'moving_guide') {
            setAppState(produce((draft: AppState) => {
                const { guide } = interaction;
                const guideIndex = draft.guides.findIndex(g => g.id === guide.id);
                if (guideIndex > -1) {
                    const pos = guide.position;
                    let onCanvas = true;
                    if (guide.orientation === 'horizontal' && (pos < 0 || pos > contentHeight)) {
                        onCanvas = false;
                    } else if (guide.orientation === 'vertical' && (pos < 0 || pos > contentWidth)) {
                        onCanvas = false;
                    }
                    
                    if (onCanvas) {
                        draft.guides[guideIndex].position = guide.position;
                    } else {
                        draft.guides.splice(guideIndex, 1);
                    }
                }
            }));
            setInteraction({ mode: 'idle' });
            return;
        }

        if (interaction.mode === 'drawing_pattern_brush') {
            const { points, mirroredStrokeId } = interaction;
            if (points.length > 1 && activeLayerId) {
                const layer = layers.find(l => l.id === activeLayerId);
                if (layer) {
                    // Fix: Check if we are drawing a flow guide or a pattern brush stroke
                    if (activeTool === 'flow-guide') {
                        const bounds = calculatePathBounds(points);
                        
                        const newGuide: FlowGuideObject = {
                            id: String(Date.now()),
                            type: 'flow-guide',
                            points: points,
                            x: bounds.x,
                            y: bounds.y,
                            width: bounds.width,
                            height: bounds.height,
                            rotation: 0,
                            skewX: 0,
                            skewY: 0,
                            fill: 'none',
                            stroke: 'rgba(192, 132, 252, 0.8)',
                            strokeWidth: 1.5,
                            strokeDasharray: '4 4',
                            opacity: 1,
                            fillOpacity: 1,
                            strokeOpacity: 1,
                            blendMode: 'normal'
                        };
                        
                        const objectsToAdd: VectorObject[] = [newGuide];
                        
                        if (mirroredStrokeId && mirrorMode !== 'off') {
                            const mirroredGuide = applyMirrorToObject(newGuide, mirrorMode, mirrorGap, contentWidth, contentHeight);
                            mirroredGuide.id = mirroredStrokeId;
                            objectsToAdd.push(mirroredGuide);
                        }
                        
                        setAppState(produce((draft: AppState) => {
                            const l = draft.layers.find(l => l.id === activeLayerId);
                            if (l) l.objects.push(...objectsToAdd);
                        }));
                        
                    } else {
                        // Pattern Brush logic
                        const newObjects = generateObjectsFromBrushStroke(points, layer.settings, layer.color);
                        const objectsToAdd = [...newObjects];
                        
                        if (mirroredStrokeId && mirrorMode !== 'off') {
                             newObjects.forEach(obj => {
                                const m = applyMirrorToObject(obj, mirrorMode, mirrorGap, contentWidth, contentHeight);
                                m.id = `mirror-${obj.id}`;
                                objectsToAdd.push(m);
                             });
                        }
                        
                        if (objectsToAdd.length > 0) {
                            const groupBounds = calculateGroupBounds(objectsToAdd);
                            const newGroupId = `group-${Date.now()}`;
                            const newGroup: GroupObject = {
                                id: newGroupId,
                                type: 'group',
                                objectIds: objectsToAdd.map(o => o.id),
                                x: groupBounds.x,
                                y: groupBounds.y,
                                width: groupBounds.width,
                                height: groupBounds.height,
                                rotation: 0,
                                skewX: 0,
                                skewY: 0,
                                fill: 'none',
                                stroke: 'none',
                                strokeWidth: 0,
                                opacity: 1,
                                fillOpacity: 1,
                                strokeOpacity: 1,
                                blendMode: 'normal',
                            };

                            setAppState(produce((draft: AppState) => {
                                const l = draft.layers.find(l => l.id === activeLayerId);
                                if (l) {
                                    l.objects.push(...objectsToAdd, newGroup);
                                }
                            }));
                            
                            setSelectedObjectInfo({ layerId: activeLayerId, objectIds: [newGroupId] });
                        }
                    }
                }
            }
            setInteraction({ mode: 'idle' });
            setActiveTool('select');
        } else if (interaction.mode === 'drawing_path') {
             const { object, mirroredObjectId } = interaction;
             if (object.points.length > 1 && activeLayerId) {
                 const bounds = calculatePathBounds(object.points);
                 const finalObject = { ...object, ...bounds };
                 const objectsToAdd: VectorObject[] = [finalObject];
                 if (mirroredObjectId && mirrorMode !== 'off') {
                     const m = applyMirrorToObject(finalObject, mirrorMode, mirrorGap, contentWidth, contentHeight);
                     m.id = mirroredObjectId;
                     objectsToAdd.push(m);
                 }
                 setAppState(produce((draft: AppState) => {
                     const l = draft.layers.find(l => l.id === activeLayerId);
                     if (l) l.objects.push(...objectsToAdd);
                 }));
                 setSelectedObjectInfo({ layerId: activeLayerId, objectIds: objectsToAdd.map(o => o.id) });
             }
             setInteraction({ mode: 'idle' });
             setActiveTool('select');
        } else if (interaction.mode === 'drawing_object' || interaction.mode === 'drawing_line' || interaction.mode === 'drawing_measurement') {
             let { object } = interaction;
             const { mirroredObjectId } = interaction;
             
             // Check if we created a measurement by clicking (not dragging) on a known object
             // If dx and dy are small (< 5px), convert to Smart Measurement
             const startPoint = 'startPoint' in interaction ? interaction.startPoint : null;
             let isSmartClick = false;
             let smartRefId: string | undefined;
             
             if (interaction.mode === 'drawing_measurement' && startPoint && activeLayer) {
                 const mObj = object as MeasurementObject;
                 const dx = mObj.x2 - mObj.x1;
                 const dy = mObj.y2 - mObj.y1;
                 const dist = Math.sqrt(dx*dx + dy*dy);
                 
                 if (dist < 5) {
                     // Clicked without dragging significantly
                     // Check what we clicked on
                     const clickPoint = startPoint;
                     // Simple hit test
                     // Iterate reverse to find top-most
                     for (let i = activeLayer.objects.length - 1; i >= 0; i--) {
                         const potentialRef = activeLayer.objects[i];
                         // Skip if it's the one we are currently drawing (though it hasn't been added to layer yet, so safe)
                         // Simple bbox check for now or use hit logic
                         const bounds = getObjectVisualBounds(potentialRef);
                         if (clickPoint[0] >= bounds.x && clickPoint[0] <= bounds.x + bounds.width &&
                             clickPoint[1] >= bounds.y && clickPoint[1] <= bounds.y + bounds.height) {
                             
                             smartRefId = potentialRef.id;
                             isSmartClick = true;
                             
                             // Convert object to Smart Measurement based on target type
                             // Clone object to avoid mutation of read-only state property if needed, though here we replace it in local var
                             const newMObj = { ...mObj };
                             const refObj = potentialRef;
                             newMObj.referenceId = refObj.id;
                             
                             // Set position based on object bounds center
                             const cx = bounds.x + bounds.width / 2;
                             const cy = bounds.y + bounds.height / 2;
                             
                             if (refObj.type === 'shape' && (refObj.shapeType === 'ellipse' || refObj.shapeType === 'ring')) {
                                 newMObj.measurementType = 'diameter';
                                 // Diameter line: Left to Right
                                 newMObj.x1 = bounds.x; 
                                 newMObj.y1 = cy;
                                 newMObj.x2 = bounds.x + bounds.width;
                                 newMObj.y2 = cy;
                             } else if (refObj.type === 'polygon' && (refObj as PolygonObject).isClosed) {
                                 newMObj.measurementType = 'area';
                                 newMObj.x1 = cx; newMObj.y1 = cy; newMObj.x2 = cx; newMObj.y2 = cy; // Point measurement
                             } else if (refObj.type === 'shape') { // Rect, etc
                                 newMObj.measurementType = 'area';
                                 newMObj.x1 = cx; newMObj.y1 = cy; newMObj.x2 = cx; newMObj.y2 = cy;
                             } else if (refObj.type === 'path' || refObj.type === 'line') {
                                 newMObj.measurementType = 'perimeter'; // Length
                                 newMObj.x1 = cx; newMObj.y1 = cy; newMObj.x2 = cx; newMObj.y2 = cy;
                             }
                             
                             newMObj.x = Math.min(newMObj.x1, newMObj.x2);
                             newMObj.y = Math.min(newMObj.y1, newMObj.y2);
                             newMObj.width = Math.abs(newMObj.x2 - newMObj.x1);
                             newMObj.height = Math.abs(newMObj.y2 - newMObj.y1);
                             
                             object = newMObj;
                             break;
                         }
                     }
                 }
             }

             const isValid = (object.width > 0 || object.height > 0) || (object.type === 'line' || object.type === 'measurement') || isSmartClick;
             
             if (isValid && activeLayerId) {
                 const objectsToAdd: VectorObject[] = [object];
                 if (mirroredObjectId && mirrorMode !== 'off' && !isSmartClick) {
                     const m = applyMirrorToObject(object, mirrorMode, mirrorGap, contentWidth, contentHeight);
                     m.id = mirroredObjectId;
                     objectsToAdd.push(m);
                 }
                 setAppState(produce((draft: AppState) => {
                     const l = draft.layers.find(l => l.id === activeLayerId);
                     if (l) l.objects.push(...objectsToAdd);
                 }));
                 setSelectedObjectInfo({ layerId: activeLayerId, objectIds: objectsToAdd.map(o => o.id) });
             }
             setInteraction({ mode: 'idle' });
             setActiveTool('select');
        } else if (interaction.mode === 'measuring') {
             setInteraction({ mode: 'idle' });
        } else if (interaction.mode === 'marquee_selection') {
             const { startPoint, currentPoint, shiftKey } = interaction;
             // Calculate selection bounds
             const x = Math.min(startPoint[0], currentPoint[0]);
             const y = Math.min(startPoint[1], currentPoint[1]);
             const w = Math.abs(startPoint[0] - currentPoint[0]);
             const h = Math.abs(startPoint[1] - currentPoint[1]);
             
             // Find objects in bounds on active layer
             if (activeLayer) {
                 const hitIds: string[] = [];
                 activeLayer.objects.forEach(obj => {
                     // Simple bbox check for now
                     const bounds = getObjectVisualBounds(obj);
                     const objRight = bounds.x + bounds.width;
                     const objBottom = bounds.y + bounds.height;
                     const selRight = x + w;
                     const selBottom = y + h;
                     
                     if (bounds.x < selRight && objRight > x && bounds.y < selBottom && objBottom > y) {
                         hitIds.push(obj.id);
                     }
                 });
                 
                 if (hitIds.length > 0) {
                     if (shiftKey && selectedObjectInfo && selectedObjectInfo.layerId === activeLayer.id) {
                         const newIds = new Set([...selectedObjectInfo.objectIds, ...hitIds]);
                         setSelectedObjectInfo({ layerId: activeLayer.id, objectIds: Array.from(newIds) });
                     } else {
                         setSelectedObjectInfo({ layerId: activeLayer.id, objectIds: hitIds });
                     }
                 } else if (!shiftKey) {
                     setSelectedObjectInfo(null);
                 }
             }
             setInteraction({ mode: 'idle' });
        } else if (interaction.mode !== 'idle' && interaction.mode !== 'drawing_polygon' && interaction.mode !== 'editing_text' && interaction.mode !== 'drawing') {
             // Stop moving/resizing/rotating/panning
             setInteraction({ mode: 'idle' });
             setActiveGuides([]);
        }
    }, [interaction, setActiveTool, activeLayer, activeLayerId, layers, selectedObjectInfo, setSelectedObjectInfo, setInteraction, setAppState, mirrorMode, mirrorGap, contentWidth, contentHeight, setActiveGuides, activeTool, commitHistory]);

    /**
     * Updates the text content of the currently selected text object.
     * @param text - The new text string.
     */
    const handleUpdateTextContent = useCallback((text: string) => {
        if (interaction.mode !== 'editing_text') return;
        handleUpdateSelectedObjects({ text });
    }, [interaction, handleUpdateSelectedObjects]);

    /**
     * Finishes text editing mode and returns to idle state.
     */
    const handleFinishTextEditing = useCallback(() => {
        if (interaction.mode === 'editing_text') {
            setInteraction({ mode: 'idle' });
        }
    }, [interaction, setInteraction]);

    /**
     * Clears the current clipping path from the active layer.
     */
    const handleClearClipPath = useCallback(() => {
        handleUpdateActiveLayer(l => {
            l.clipPolygonPoints = [];
            l.isClipPolygonClosed = false;
            l.useClipping = false;
        });
    }, [handleUpdateActiveLayer]);

    return {
        handleCanvasMouseDown,
        handleRulerMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        handleCanvasDoubleClick: (hitInfo: HoverInfo | null) => {
            if (interaction.mode === 'idle') {
                if (hitInfo?.type === 'object') {
                    const { layerId, objectId } = hitInfo;
                    const layer = layers.find(l => l.id === layerId);
                    const object = layer?.objects.find(o => o.id === objectId);
                    if (object?.type === 'text' && !layer?.isLocked) {
                        setInteraction({ mode: 'editing_text', layerId, objectId });
                        setSelectedObjectInfo({ layerId, objectIds: [objectId] });
                    }
                }
            }
        },
        handleUpdateTextContent,
        handleFinishTextEditing,
        handleClearClipPath
    };
};
