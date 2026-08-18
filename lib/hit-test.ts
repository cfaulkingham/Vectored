import { polygonContains } from 'd3';
import type { 
    Point, 
    HoverInfo, 
    InteractionState, 
    Layer, 
    VectorObject, 
    ResizeHandle, 
    PolygonObject, 
    LineObject, 
    MeasurementObject, 
    RenderableElement,
    PolygonVertex,
    Guide
} from '../types';
import { 
    distSq, 
    distToSegmentSq, 
    getObjectAsPolygon, 
    transformLayerLocalPointToWorld, 
    transformWorldPointToLayerLocal, 
    getTransformMatrix, 
    transformPoint, 
    getObjectHandlePosition, 
    calculateGroupBounds, 
    rotatePoint 
} from './geometry';

export const HIT_THRESHOLD_SQ = 100; // 10px squared

export interface HitTestContext {
    worldPoint: Point | null;
    viewState: { zoom: number; pan: { x: number; y: number } };
    interaction: InteractionState;
    editingMode: 'shape' | 'clip' | 'layer';
    activeTool: string;
    activeLayerId: string | null;
    activeLayer: Layer | undefined;
    activeLayerClipPolygonPoints: PolygonVertex[];
    layers: { layer: Layer; elements: RenderableElement[] }[];
    selectedObjects: VectorObject[];
    guides: Guide[];
    width: number;
    height: number;
}

/**
 * Performs hit testing on canvas objects, handles, guides, and control points.
 */
export function performHitTest(ctx: HitTestContext): { foundInfo: HoverInfo | null; pointForMove: Point | null } {
    const {
        worldPoint,
        viewState,
        interaction,
        editingMode,
        activeTool,
        activeLayerId,
        activeLayer,
        activeLayerClipPolygonPoints,
        layers,
        selectedObjects,
        guides,
        width,
        height
    } = ctx;

    if (!worldPoint) return { foundInfo: null, pointForMove: null };

    const effectiveHitThresholdSq = HIT_THRESHOLD_SQ / (viewState.zoom * viewState.zoom);
    let foundInfo: HoverInfo | null = null;
    let pointForMove: Point | null = worldPoint;

    if (interaction.mode === 'drawing_polygon') {
        const poly = interaction.object as PolygonObject;
        if (poly.points.length >= 3) {
            const firstPoint = poly.points[0].anchor;
            if (distSq(worldPoint, firstPoint) < effectiveHitThresholdSq) {
                foundInfo = { type: 'close_polygon' };
                pointForMove = firstPoint; // Snap!
            }
        }
    } else if (interaction.mode === 'drawing' && editingMode === 'clip') {
        const points = activeLayerClipPolygonPoints;
        if (points.length >= 3 && activeLayer) {
            const firstPoint = points[0].anchor;
            const firstPointWorld = transformLayerLocalPointToWorld(firstPoint, activeLayer, { width, height });
            if (distSq(worldPoint, firstPointWorld) < effectiveHitThresholdSq) {
                foundInfo = { type: 'close_polygon' };
                pointForMove = firstPointWorld;
            }
        }
    } else if (interaction.mode === 'idle') {
        const point = worldPoint;

        // Specialized Hit Testing for Measure Tool
        if (activeTool === 'measure' && activeLayer) {
            const pointForLayer = transformWorldPointToLayerLocal(point, activeLayer, { width, height });

            for (let i = activeLayer.objects.length - 1; i >= 0; i--) {
                const obj = activeLayer.objects[i];
                if (obj.type === 'group' || obj.type === 'image') continue;

                const polyPoints = getObjectAsPolygon(obj);
                if (polyPoints) {
                    const isClosed = obj.type === 'polygon' ? (obj as PolygonObject).isClosed : 
                                     obj.type === 'path' ? false : true;
                    const pointsToCheck = isClosed ? [...polyPoints, polyPoints[0]] : polyPoints;
                    
                    for (let j = 0; j < pointsToCheck.length - 1; j++) {
                        const p1 = pointsToCheck[j];
                        const p2 = pointsToCheck[j + 1];
                        if (distToSegmentSq(pointForLayer, p1, p2) < effectiveHitThresholdSq) {
                            const p1World = transformLayerLocalPointToWorld(p1, activeLayer, { width, height });
                            const p2World = transformLayerLocalPointToWorld(p2, activeLayer, { width, height });
                            foundInfo = { type: 'measure_segment', p1: p1World, p2: p2World, objectId: obj.id };
                            break;
                        }
                    }
                }
                if (foundInfo) break;
            }
        }

        if (!foundInfo) {
            if (editingMode === 'layer') {
                if (activeLayer) {
                    const effectiveScale = activeLayer.scale || 1;
                    const localPoint = transformWorldPointToLayerLocal(point, activeLayer, { width, height });

                    const handles: { name: ResizeHandle; pos: Point }[] = [
                        { name: 'top-left', pos: [0, 0] }, { name: 'top', pos: [width / 2, 0] }, { name: 'top-right', pos: [width, 0] },
                        { name: 'left', pos: [0, height / 2] }, { name: 'right', pos: [width, height / 2] },
                        { name: 'bottom-left', pos: [0, height] }, { name: 'bottom', pos: [width / 2, height] }, { name: 'bottom-right', pos: [width, height] },
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
            } else if (editingMode === 'shape') {
                const activeLayerForHit = layers.find(l => l.layer.id === activeLayerId)?.layer;
                let transformedPointForHandles = point;
                if (activeLayerForHit) {
                    transformedPointForHandles = transformWorldPointToLayerLocal(point, activeLayerForHit, { width, height });
                }

                if (activeTool === 'node' && activeLayerForHit) {
                    for (let i = activeLayerForHit.objects.length - 1; i >= 0; i--) {
                        const obj = activeLayerForHit.objects[i];
                        if (obj.type !== 'polygon') continue;
                        
                        const center: Point = [obj.x + obj.width / 2, obj.y + obj.height / 2];
                        const rad = -obj.rotation * Math.PI / 180;
                        const localPoint = rotatePoint(transformedPointForHandles, center, rad);

                        const polyPoints = (obj as PolygonObject).points;
                        for (let k = 0; k < polyPoints.length; k++) {
                            const vertex = polyPoints[k];
                            if (distSq(localPoint, vertex.anchor) < effectiveHitThresholdSq) { 
                                foundInfo = { type: 'polygon_anchor', layerId: activeLayerForHit.id, objectId: obj.id, vertexIndex: k }; 
                                break; 
                            }
                            if (distSq(localPoint, vertex.handle1) < effectiveHitThresholdSq) { 
                                foundInfo = { type: 'polygon_handle', layerId: activeLayerForHit.id, objectId: obj.id, vertexIndex: k, handleKey: 'handle1' }; 
                                break; 
                            }
                            if (distSq(localPoint, vertex.handle2) < effectiveHitThresholdSq) { 
                                foundInfo = { type: 'polygon_handle', layerId: activeLayerForHit.id, objectId: obj.id, vertexIndex: k, handleKey: 'handle2' }; 
                                break; 
                            }
                        }
                        if (foundInfo) break;

                        const pathPoints = (obj as PolygonObject).isClosed ? [...polyPoints, polyPoints[0]] : polyPoints;
                        for (let k = 0; k < pathPoints.length - 1; k++) {
                            if (distToSegmentSq(localPoint, pathPoints[k].anchor, pathPoints[k + 1].anchor) < effectiveHitThresholdSq) {
                                foundInfo = { type: 'polygon_segment', layerId: activeLayerForHit.id, objectId: obj.id, segmentIndex: k }; 
                                break;
                            }
                        }
                        if (foundInfo) break;
                    }
                } else if (activeTool === 'select') {
                    if (!foundInfo && selectedObjects.length > 0) {
                        if (selectedObjects.length === 1) {
                            const obj = selectedObjects[0];
                            const handlesList: ResizeHandle[] = [
                                'top-left', 'top', 'top-right',
                                'left', 'right',
                                'bottom-left', 'bottom', 'bottom-right'
                            ];
                            
                            for (const handleName of handlesList) {
                                const handlePos = getObjectHandlePosition(obj, handleName);
                                if (distSq(transformedPointForHandles, handlePos) < effectiveHitThresholdSq) {
                                    foundInfo = { type: 'resize_handle', layerId: activeLayerId!, objectId: obj.id, handle: handleName };
                                    break;
                                }
                            }
                            
                            if (!foundInfo) {
                                const rotOffsetY = 20 / viewState.zoom;
                                const rotHandleLocal: Point = [obj.x + obj.width / 2, obj.y - rotOffsetY];
                                const cx = obj.x + obj.width / 2;
                                const cy = obj.y + obj.height / 2;
                                const localRotPoint: Point = [rotHandleLocal[0] - cx, rotHandleLocal[1] - cy];
                                
                                const skX = (obj.skewX || 0) * Math.PI / 180;
                                const skY = (obj.skewY || 0) * Math.PI / 180;
                                const skewedX = localRotPoint[0] + localRotPoint[1] * Math.tan(skX);
                                const skewedY = localRotPoint[0] * Math.tan(skY) + localRotPoint[1];
                                
                                const rot = (obj.rotation || 0) * Math.PI / 180;
                                const rotatedX = skewedX * Math.cos(rot) - skewedY * Math.sin(rot);
                                const rotatedY = skewedX * Math.sin(rot) + skewedY * Math.cos(rot);
                                
                                const rotPos: Point = [rotatedX + cx, rotatedY + cy];
                                
                                if (distSq(transformedPointForHandles, rotPos) < effectiveHitThresholdSq) {
                                    foundInfo = { type: 'rotate_handle', layerId: activeLayerId!, objectId: obj.id };
                                }
                            }
                        } else {
                            const bounds = calculateGroupBounds(selectedObjects);
                            const handles: { name: ResizeHandle; pos: Point }[] = [
                                { name: 'top-left', pos: [bounds.x, bounds.y] }, 
                                { name: 'top', pos: [bounds.x + bounds.width / 2, bounds.y] }, 
                                { name: 'top-right', pos: [bounds.x + bounds.width, bounds.y] },
                                { name: 'left', pos: [bounds.x, bounds.y + bounds.height / 2] }, 
                                { name: 'right', pos: [bounds.x + bounds.width, bounds.y + bounds.height / 2] },
                                { name: 'bottom-left', pos: [bounds.x, bounds.y + bounds.height] }, 
                                { name: 'bottom', pos: [bounds.x + bounds.width / 2, bounds.y + bounds.height] }, 
                                { name: 'bottom-right', pos: [bounds.x + bounds.width, bounds.y + bounds.height] },
                            ];
            
                            for (const handle of handles) {
                                if (distSq(transformedPointForHandles, handle.pos) < effectiveHitThresholdSq) {
                                    foundInfo = { type: 'resize_handle', layerId: activeLayerId!, objectId: selectedObjects[0].id, handle: handle.name };
                                    break;
                                }
                            }
                            if (!foundInfo) {
                                const rotHandlePos: Point = [bounds.x + bounds.width / 2, bounds.y - (20 / viewState.zoom)];
                                if (distSq(transformedPointForHandles, rotHandlePos) < effectiveHitThresholdSq) {
                                    foundInfo = { type: 'rotate_handle', layerId: activeLayerId!, objectId: selectedObjects[0].id };
                                }
                            }
                        }
                    }

                    // Check General Objects
                    if (!foundInfo) {
                        for (let i = layers.length - 1; i >= 0; i--) {
                            const { layer } = layers[i];
                            if (layer.isLocked) continue;

                            const pointForLayer = transformWorldPointToLayerLocal(point, layer, { width, height });

                            for (let j = layer.objects.length - 1; j >= 0; j--) {
                                const obj = layer.objects[j];

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
                                    isInside = polygonContains((obj as PolygonObject).points.map(pt => pt.anchor), localPoint);
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
                    const localPoint = transformWorldPointToLayerLocal(point, activeLayer, { width, height });

                    const { offsetX = 0, offsetY = 0 } = activeLayer;
                    const pivot: Point = [width / 2, height / 2];
                    const handlePos: Point = [pivot[0] + offsetX, pivot[1] + offsetY];
                    if (distSq(point, handlePos) < effectiveHitThresholdSq) {
                        foundInfo = { type: 'layer_handle' };
                    }
                    
                    if (!foundInfo) {
                        const points = activeLayerClipPolygonPoints;
                        const isClosed = activeLayer.isClipPolygonClosed;
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
                                const p2: Point = pathPoints[i + 1].anchor;
                                if (distToSegmentSq(localPoint, p1, p2) < effectiveHitThresholdSq) { 
                                    foundInfo = { type: 'segment', segmentIndex: i }; 
                                    break; 
                                }
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
                } else {
                    if (Math.abs(point[0] - guide.position) < hitThreshold) {
                        foundInfo = { type: 'guide', guide };
                        break;
                    }
                }
            }
        }
    }

    return { foundInfo, pointForMove };
}

/**
 * Calculates cursor CSS property for canvas view.
 */
export function calculateCanvasCursor(params: {
    isPanningState: boolean;
    isSpacePressed: boolean;
    isShiftPressed: boolean;
    isAltPressed: boolean;
    interaction: InteractionState;
    hoverInfo: HoverInfo | null;
    editingMode: 'shape' | 'clip' | 'layer';
    activeTool: string;
    selectedObjects: VectorObject[];
}): string {
    const {
        isPanningState,
        isSpacePressed,
        isShiftPressed,
        isAltPressed,
        interaction,
        hoverInfo,
        editingMode,
        activeTool,
        selectedObjects
    } = params;

    if (isPanningState) return 'grabbing';
    if (isSpacePressed) return 'grab';
    if (interaction.mode === 'editing_text') return 'text';
    if (interaction.mode === 'moving_clip_path' || interaction.mode === 'moving_object' || interaction.mode === 'moving_layer') return 'grabbing';
    if (interaction.mode === 'moving_polygon_anchor' || interaction.mode === 'moving_anchor') return 'crosshair';
    if (hoverInfo?.type === 'guide' || interaction.mode === 'moving_guide' || interaction.mode === 'dragging_new_guide') {
        const orientation = hoverInfo?.type === 'guide' ? hoverInfo.guide.orientation : (interaction.mode === 'moving_guide' ? interaction.guide.orientation : (interaction as any).orientation);
        return orientation === 'horizontal' ? 'ns-resize' : 'ew-resize';
    }

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
        const angle = (rotation % 360 + 360) % 360;
        
        const getCursorForAngle = (base: 'ns' | 'ew' | 'nwse' | 'nesw') => {
            const diagonalThreshold = 22.5;
            if (base === 'ns') {
                if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'ns-resize';
                if ((angle > 45 - diagonalThreshold && angle < 45 + diagonalThreshold) || (angle > 225 - diagonalThreshold && angle < 225 + diagonalThreshold)) return 'nesw-resize';
                if ((angle > 90 - diagonalThreshold && angle < 90 + diagonalThreshold) || (angle > 270 - diagonalThreshold && angle < 270 + diagonalThreshold)) return 'ew-resize';
                return 'nwse-resize';
            }
            if (base === 'ew') {
                if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'ew-resize';
                if ((angle > 45 - diagonalThreshold && angle < 45 + diagonalThreshold) || (angle > 225 - diagonalThreshold && angle < 225 + diagonalThreshold)) return 'nwse-resize';
                if ((angle > 90 - diagonalThreshold && angle < 90 + diagonalThreshold) || (angle > 270 - diagonalThreshold && angle < 270 + diagonalThreshold)) return 'ns-resize';
                return 'nesw-resize';
            }
            if (base === 'nwse') {
                if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'nwse-resize';
                if ((angle > 45 - diagonalThreshold && angle < 45 + diagonalThreshold) || (angle > 225 - diagonalThreshold && angle < 225 + diagonalThreshold)) return 'ns-resize';
                if ((angle > 90 - diagonalThreshold && angle < 90 + diagonalThreshold) || (angle > 270 - diagonalThreshold && angle < 270 + diagonalThreshold)) return 'nesw-resize';
                return 'ew-resize';
            }
            if (angle < diagonalThreshold || angle > 360 - diagonalThreshold || (angle > 180 - diagonalThreshold && angle < 180 + diagonalThreshold)) return 'nesw-resize';
            if ((angle > 45 - diagonalThreshold && angle < 45 + diagonalThreshold) || (angle > 225 - diagonalThreshold && angle < 225 + diagonalThreshold)) return 'ew-resize';
            if ((angle > 90 - diagonalThreshold && angle < 90 + diagonalThreshold) || (angle > 270 - diagonalThreshold && angle < 270 + diagonalThreshold)) return 'nwse-resize';
            return 'ns-resize';
        };

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
    
    if (hoverInfo?.type === 'polygon_handle') return 'grab';
    if (hoverInfo?.type === 'polygon_segment') return 'pointer';

    if (activeTool === 'select') return 'default';
    
    return 'crosshair';
}
