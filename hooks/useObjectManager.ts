
import React, { useCallback, useMemo } from 'react';
import { produce } from 'immer';
import type { AppState, VectorObject, Layer, GroupObject, PathObject, LineObject, PolygonObject, ShapeObject, TextObject, MeasurementObject, InteractionState, AlignmentType, Gradient, PathGroupObject, FlowGuideObject, GenericPathObject, Point, VectorObjectType } from '../types';
import { calculateGroupBounds, getObjectVisualBounds, applyMirrorToObject, getTransformMatrix, transformPoint, calculatePolygonBounds, calculatePathBounds, getSVGPathFromObject, getPathTotalLength, getPointAndTangentAtLength, getObjectAsPolygon, flattenBezier, calculatePolygonArea, calculatePolygonPerimeter } from '../lib/geometry';
import { convertObjectToPolygon } from '../lib/path-converter';
import { performBooleanOperation } from '../lib/boolean-operations';
import { measureText } from '../lib/text-utils';

interface UseObjectManagerProps {
    appState: AppState;
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
    selectedObjectInfo: { layerId: string; objectIds: string[] } | null;
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    clipboardObject: VectorObject | null;
    setClipboardObject: React.Dispatch<React.SetStateAction<VectorObject | null>>;
    mirrorMode: any; // MirrorMode
    mirrorGap: number;
    interaction: InteractionState;
    setInteraction: React.Dispatch<React.SetStateAction<InteractionState>>;
    updateLayerPattern: (layer: Layer, newSettings: any) => void;
    loadGoogleFonts: (fonts: Set<string>) => void;
    setActiveTool: React.Dispatch<React.SetStateAction<'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure'>>;
}

// Helper to filter out selected objects that are descendants of other selected objects (groups)
// ensuring we don't apply transformations twice (once for group, once for child)
const getTopLevelSelectedIds = (layer: Layer, selectedIds: string[]): string[] => {
    const parentMap = new Map<string, string>();
    layer.objects.forEach(obj => {
        if (obj.type === 'group') {
            (obj as GroupObject).objectIds.forEach(childId => {
                parentMap.set(childId, obj.id);
            });
        }
    });

    const selectedIdsSet = new Set(selectedIds);
    return selectedIds.filter(id => {
        let current = id;
        while (true) {
            const parent = parentMap.get(current);
            if (!parent) break;
            if (selectedIdsSet.has(parent)) return false; // Ancestor is selected
            current = parent;
        }
        return true;
    });
};

/**
 * Custom hook managing object-level operations.
 * Handles selection, deletion, movement, transformation, grouping,
 * alignment, boolean operations, and other object manipulations.
 *
 * @returns An object containing the current selection state and handlers for all object actions.
 */
export const useObjectManager = ({
    appState,
    setAppState,
    selectedObjectInfo,
    setSelectedObjectInfo,
    clipboardObject,
    setClipboardObject,
    mirrorMode,
    mirrorGap,
    interaction,
    setInteraction,
    updateLayerPattern,
    loadGoogleFonts,
    setActiveTool
}: UseObjectManagerProps) => {
    const { layers, activeLayerId, canvasConfig } = appState;
    const contentWidth = canvasConfig.width;
    const contentHeight = canvasConfig.height;

    const selectedObjects = useMemo(() => {
        if (!selectedObjectInfo) return [];
        const layer = layers.find(l => l.id === selectedObjectInfo.layerId);
        if (!layer) return [];
        return selectedObjectInfo.objectIds.map(id => layer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];
    }, [layers, selectedObjectInfo]);

    const activeLayer = layers.find(l => l.id === activeLayerId);

    const canGroup = selectedObjects.length > 1;
    const canUngroup = selectedObjects.some(o => o.type === 'group' || o.type === 'path-group');
    
    const canConvertToPath = useMemo(() => {
        return selectedObjects.length > 0 && selectedObjects.every(obj => ['shape', 'line', 'generic-path', 'path'].includes(obj.type));
    }, [selectedObjects]);
    
    const isAttachToPathEnabled = useMemo(() => {
        if (selectedObjects.length < 2) return false;
        // The last selected object must be a valid path container
        const lastObj = selectedObjects[selectedObjects.length - 1];
        return ['path', 'generic-path', 'shape', 'polygon', 'line'].includes(lastObj.type);
    }, [selectedObjects]);

    const uniqueFills = useMemo(() => {
        if (!activeLayer) return [];
        const fills = new Set<string | Gradient>();
        activeLayer.objects.forEach(obj => {
            if (obj.fill !== 'none') fills.add(obj.fill);
        });
        return Array.from(fills);
    }, [activeLayer]);

    const handleUpdateSelectedObjects = useCallback((props: Partial<VectorObject>) => {
        setAppState(produce((draft: AppState) => {
            if (!selectedObjectInfo) return;
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (!layer) return;

            selectedObjectInfo.objectIds.forEach(id => {
                const obj = layer.objects.find(o => o.id === id);
                if (obj) {
                    Object.assign(obj, props);
                    // Re-calculate bounds for specific types if geometry changed
                    if ('points' in props && props.points && obj.type === 'polygon') {
                        Object.assign(obj, calculatePolygonBounds((obj as PolygonObject).points));
                    }
                    if ('points' in props && props.points && (obj.type === 'path' || obj.type === 'flow-guide')) {
                        Object.assign(obj, calculatePathBounds((obj as PathObject).points));
                    }
                    
                    // Automatically recalculate bounds for text objects if text properties change
                    if (obj.type === 'text') {
                        const tObj = obj as TextObject;
                        const textProps = props as Partial<TextObject>;
                        if (textProps.text !== undefined || textProps.fontSize !== undefined || textProps.fontFamily !== undefined || textProps.fontWeight !== undefined || textProps.lineHeight !== undefined || textProps.letterSpacing !== undefined) {
                            const { width, height } = measureText(tObj.text, tObj.fontSize, tObj.fontFamily, tObj.fontWeight, tObj.lineHeight ?? 1.2, tObj.letterSpacing ?? 0);
                            tObj.width = width;
                            tObj.height = height;
                        }
                    }
                }
            });
        }));
    }, [selectedObjectInfo, setAppState]);

    const handleDeleteSelectedObjects = useCallback(() => {
        setAppState(produce((draft: AppState) => {
            if (!selectedObjectInfo) return;
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (layer) {
                layer.objects = layer.objects.filter(o => !selectedObjectInfo.objectIds.includes(o.id));
            }
        }));
        setSelectedObjectInfo(null);
        setInteraction({ mode: 'idle' });
    }, [selectedObjectInfo, setAppState, setSelectedObjectInfo, setInteraction]);

    const handleCopySelectedObject = useCallback(() => {
        if (selectedObjects.length > 0) {
            if (selectedObjects.length === 1) {
                setClipboardObject(selectedObjects[0]);
            } else {
                // Copy as a group-like structure or just the first one?
                // For simplicity, let's create a temporary group for clipboard or just copy the first.
                // Better: Group them temporarily.
                const bounds = calculateGroupBounds(selectedObjects);
                const group: GroupObject = {
                    id: 'temp-group',
                    type: 'group',
                    objectIds: selectedObjects.map(o => o.id),
                    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                    rotation: 0, skewX: 0, skewY: 0,
                    fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 1,
                    fillOpacity: 1, strokeOpacity: 1, blendMode: 'normal'
                };
                setClipboardObject(group);
            }
        }
    }, [selectedObjects, setClipboardObject]);

    const handlePasteObject = useCallback(() => {
        if (!clipboardObject || !activeLayerId) return;
    
        const newObject = produce(clipboardObject, (draft: any) => {
            draft.id = String(Date.now() + Math.random());
            const offset = 20;
    
            if ('x' in draft) draft.x += offset;
            if ('y' in draft) draft.y += offset;
    
            if (draft.type === 'polygon') {
                draft.points.forEach((p: any) => {
                    p.anchor = [p.anchor[0] + offset, p.anchor[1] + offset];
                    p.handle1 = [p.handle1[0] + offset, p.handle1[1] + offset];
                    p.handle2 = [p.handle2[0] + offset, p.handle2[1] + offset];
                });
            } else if (draft.type === 'path') {
                draft.points = draft.points.map((p: any) => [p[0] + offset, p[1] + offset]);
            } else if (draft.type === 'line') {
                draft.x1 += offset;
                draft.y1 += offset;
                draft.x2 += offset;
                draft.y2 += offset;
            }
        });
    
        const objectsToAdd: VectorObject[] = [newObject];
        let mirroredObjectId: string | undefined;
        if (mirrorMode !== 'off') {
            const mirroredObject = applyMirrorToObject(newObject, mirrorMode, mirrorGap, contentWidth, contentHeight);
            mirroredObject.id = `mirror-${newObject.id}`;
            mirroredObjectId = mirroredObject.id;
            objectsToAdd.push(mirroredObject);
        }
    
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === draft.activeLayerId);
            if (layer) {
                layer.objects.push(...objectsToAdd);
            }
        }));
    
        const idsToSelect = [newObject.id];
        if (mirroredObjectId) idsToSelect.push(mirroredObjectId);
        setSelectedObjectInfo({ layerId: activeLayerId, objectIds: idsToSelect });
    }, [clipboardObject, activeLayerId, setAppState, mirrorMode, mirrorGap, contentWidth, contentHeight, setSelectedObjectInfo]);

    const handleMoveSelectedObjects = useCallback((dx: number, dy: number) => {
        setAppState(produce((draft: AppState) => {
            if (!selectedObjectInfo) return;
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (!layer) return;

            const moveRecursive = (obj: VectorObject, mDx: number, mDy: number) => {
                obj.x += mDx;
                obj.y += mDy;
                
                if (obj.type === 'polygon') {
                    (obj as PolygonObject).points.forEach(p => {
                        p.anchor[0] += mDx; p.anchor[1] += mDy;
                        p.handle1[0] += mDx; p.handle1[1] += mDy;
                        p.handle2[0] += mDx; p.handle2[1] += mDy;
                    });
                } else if (obj.type === 'path' || obj.type === 'flow-guide') {
                    (obj as PathObject).points.forEach(p => { p[0] += mDx; p[1] += mDy; });
                } else if (obj.type === 'line') {
                    (obj as LineObject).x1 += mDx; (obj as LineObject).y1 += mDy;
                    (obj as LineObject).x2 += mDx; (obj as LineObject).y2 += mDy;
                } else if (obj.type === 'measurement') {
                    (obj as MeasurementObject).x1 += mDx; (obj as MeasurementObject).y1 += mDy;
                    (obj as MeasurementObject).x2 += mDx; (obj as MeasurementObject).y2 += mDy;
                }

                if (obj.type === 'group') {
                    (obj as GroupObject).objectIds.forEach(childId => {
                        const child = layer.objects.find(o => o.id === childId);
                        if (child) moveRecursive(child, mDx, mDy);
                    });
                }
            };

            // Use filtered IDs to prevent double movement
            const topLevelIds = getTopLevelSelectedIds(layer, selectedObjectInfo.objectIds);
            
            topLevelIds.forEach(id => {
                const obj = layer.objects.find(o => o.id === id);
                if (obj) moveRecursive(obj, dx, dy);
            });
        }), { coalesce: true });
    }, [selectedObjectInfo, setAppState]);

    const handleReorderObject = useCallback((direction: 'forward' | 'backward' | 'front' | 'back') => {
        setAppState(produce((draft: AppState) => {
            if (!selectedObjectInfo) return;
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (!layer) return;

            const indices = selectedObjectInfo.objectIds.map(id => layer.objects.findIndex(o => o.id === id)).sort((a, b) => a - b);
            if (indices[0] === -1) return;

            if (direction === 'back') {
                const objectsToMove = indices.map(i => layer.objects[i]);
                const remaining = layer.objects.filter((_, i) => !indices.includes(i));
                layer.objects = [...objectsToMove, ...remaining];
            } else if (direction === 'front') {
                const objectsToMove = indices.map(i => layer.objects[i]);
                const remaining = layer.objects.filter((_, i) => !indices.includes(i));
                layer.objects = [...remaining, ...objectsToMove];
            } else if (direction === 'backward') {
                // Simple implementation: move block up/down
                for (let i = 0; i < indices.length; i++) {
                    const idx = indices[i];
                    if (idx > 0 && !indices.includes(idx - 1)) {
                        [layer.objects[idx], layer.objects[idx - 1]] = [layer.objects[idx - 1], layer.objects[idx]];
                    }
                }
            } else if (direction === 'forward') {
                for (let i = indices.length - 1; i >= 0; i--) {
                    const idx = indices[i];
                    if (idx < layer.objects.length - 1 && !indices.includes(idx + 1)) {
                        [layer.objects[idx], layer.objects[idx + 1]] = [layer.objects[idx + 1], layer.objects[idx]];
                    }
                }
            }
        }));
    }, [selectedObjectInfo, setAppState]);

    const handleAlignObjects = useCallback((alignment: AlignmentType) => {
        if (selectedObjects.length < 2) return;
        
        // Pre-calculation for distribution
        let distributionMap: Map<string, { dx: number, dy: number }> = new Map();

        if (alignment === 'distribute-h' || alignment === 'distribute-v') {
            if (selectedObjects.length < 3) return;

            const objectsWithBounds = selectedObjects.map(obj => {
                const b = getObjectVisualBounds(obj);
                return {
                    id: obj.id,
                    obj,
                    bounds: b,
                    centerX: b.x + b.width / 2,
                    centerY: b.y + b.height / 2
                };
            });

            if (alignment === 'distribute-h') {
                objectsWithBounds.sort((a, b) => a.centerX - b.centerX);
                const minX = objectsWithBounds[0].centerX;
                const maxX = objectsWithBounds[objectsWithBounds.length - 1].centerX;
                const span = maxX - minX;
                const step = span / (objectsWithBounds.length - 1);

                objectsWithBounds.forEach((item, index) => {
                    const targetCx = minX + index * step;
                    distributionMap.set(item.id, { dx: targetCx - item.centerX, dy: 0 });
                });
            } else {
                objectsWithBounds.sort((a, b) => a.centerY - b.centerY);
                const minY = objectsWithBounds[0].centerY;
                const maxY = objectsWithBounds[objectsWithBounds.length - 1].centerY;
                const span = maxY - minY;
                const step = span / (objectsWithBounds.length - 1);

                objectsWithBounds.forEach((item, index) => {
                    const targetCy = minY + index * step;
                    distributionMap.set(item.id, { dx: 0, dy: targetCy - item.centerY });
                });
            }
        }

        const bounds = calculateGroupBounds(selectedObjects);
        
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === selectedObjectInfo!.layerId);
            if (!layer) return;

            const moveRecursive = (obj: VectorObject, mDx: number, mDy: number) => {
                obj.x += mDx;
                obj.y += mDy;
                
                if (obj.type === 'polygon') {
                    (obj as PolygonObject).points.forEach(p => {
                        p.anchor[0] += mDx; p.anchor[1] += mDy;
                        p.handle1[0] += mDx; p.handle1[1] += mDy;
                        p.handle2[0] += mDx; p.handle2[1] += mDy;
                    });
                } else if (obj.type === 'path' || obj.type === 'flow-guide') {
                    (obj as PathObject).points.forEach(p => { p[0] += mDx; p[1] += mDy; });
                } else if (obj.type === 'line') {
                    (obj as LineObject).x1 += mDx; (obj as LineObject).y1 += mDy;
                    (obj as LineObject).x2 += mDx; (obj as LineObject).y2 += mDy;
                } else if (obj.type === 'measurement') {
                    (obj as MeasurementObject).x1 += mDx; (obj as MeasurementObject).y1 += mDy;
                    (obj as MeasurementObject).x2 += mDx; (obj as MeasurementObject).y2 += mDy;
                }

                if (obj.type === 'group') {
                    (obj as GroupObject).objectIds.forEach(childId => {
                        const child = layer.objects.find(o => o.id === childId);
                        if (child) moveRecursive(child, mDx, mDy);
                    });
                }
            };

            // Filter top level
            const topLevelIds = getTopLevelSelectedIds(layer, selectedObjectInfo!.objectIds);

            topLevelIds.forEach(id => {
                const obj = layer.objects.find(o => o.id === id);
                if (!obj) return;
                
                let dx = 0, dy = 0;

                if (alignment.startsWith('distribute')) {
                    const delta = distributionMap.get(id);
                    if (delta) {
                        dx = delta.dx;
                        dy = delta.dy;
                    }
                } else {
                    const objBounds = getObjectVisualBounds(obj); 
                    switch (alignment) {
                        case 'align-left': dx = bounds.x - objBounds.x; break;
                        case 'align-center-h': dx = (bounds.x + bounds.width / 2) - (objBounds.x + objBounds.width / 2); break;
                        case 'align-right': dx = (bounds.x + bounds.width) - (objBounds.x + objBounds.width); break;
                        case 'align-top': dy = bounds.y - objBounds.y; break;
                        case 'align-center-v': dy = (bounds.y + bounds.height / 2) - (objBounds.y + objBounds.height / 2); break;
                        case 'align-bottom': dy = (bounds.y + bounds.height) - (objBounds.y + objBounds.height); break;
                    }
                }

                if (dx !== 0 || dy !== 0) {
                    moveRecursive(obj, dx, dy);
                }
            });
        }));
    }, [selectedObjects, selectedObjectInfo, setAppState]);

    const handleAlignToCanvas = useCallback((alignment: AlignmentType) => {
        if (selectedObjects.length === 0) return;
        
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === selectedObjectInfo!.layerId);
            if (!layer) return;

            const moveRecursive = (obj: VectorObject, mDx: number, mDy: number) => {
                obj.x += mDx;
                obj.y += mDy;
                
                if (obj.type === 'polygon') {
                    (obj as PolygonObject).points.forEach(p => {
                        p.anchor[0] += mDx; p.anchor[1] += mDy;
                        p.handle1[0] += mDx; p.handle1[1] += mDy;
                        p.handle2[0] += mDx; p.handle2[1] += mDy;
                    });
                } else if (obj.type === 'path' || obj.type === 'flow-guide') {
                    (obj as PathObject).points.forEach(p => { p[0] += mDx; p[1] += mDy; });
                } else if (obj.type === 'line') {
                    (obj as LineObject).x1 += mDx; (obj as LineObject).y1 += mDy;
                    (obj as LineObject).x2 += mDx; (obj as LineObject).y2 += mDy;
                } else if (obj.type === 'measurement') {
                    (obj as MeasurementObject).x1 += mDx; (obj as MeasurementObject).y1 += mDy;
                    (obj as MeasurementObject).x2 += mDx; (obj as MeasurementObject).y2 += mDy;
                }

                if (obj.type === 'group') {
                    (obj as GroupObject).objectIds.forEach(childId => {
                        const child = layer.objects.find(o => o.id === childId);
                        if (child) moveRecursive(child, mDx, mDy);
                    });
                }
            };

            const topLevelIds = getTopLevelSelectedIds(layer, selectedObjectInfo!.objectIds);

            topLevelIds.forEach(id => {
                const obj = layer.objects.find(o => o.id === id);
                if (!obj) return;
                
                let dx = 0, dy = 0;
                const objBounds = getObjectVisualBounds(obj);

                switch (alignment) {
                    case 'align-left': dx = 0 - objBounds.x; break;
                    case 'align-center-h': dx = (contentWidth / 2) - (objBounds.x + objBounds.width / 2); break;
                    case 'align-right': dx = contentWidth - (objBounds.x + objBounds.width); break;
                    case 'align-top': dy = 0 - objBounds.y; break;
                    case 'align-center-v': dy = (contentHeight / 2) - (objBounds.y + objBounds.height / 2); break;
                    case 'align-bottom': dy = contentHeight - (objBounds.y + objBounds.height); break;
                }

                if (dx !== 0 || dy !== 0) {
                    moveRecursive(obj, dx, dy);
                }
            });
        }));
    }, [selectedObjects, selectedObjectInfo, setAppState, contentWidth, contentHeight]);

    const handleSelectAll = useCallback(() => {
        if (!activeLayerId) return;
        const layer = layers.find(l => l.id === activeLayerId);
        if (layer) {
            setSelectedObjectInfo({ layerId: activeLayerId, objectIds: layer.objects.map(o => o.id) });
        }
    }, [activeLayerId, layers, setSelectedObjectInfo]);

    const handleFlipObject = useCallback((direction: 'horizontal' | 'vertical') => {
        setAppState(produce((draft: AppState) => {
            if (!selectedObjectInfo) return;
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (!layer) return;

            const bounds = calculateGroupBounds(selectedObjects);
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;

            // Helper to collect all objects to flip (handling groups recursively)
            const objectsToFlip: VectorObject[] = [];
            const collectObjects = (ids: string[]) => {
                ids.forEach(id => {
                    const obj = layer.objects.find(o => o.id === id);
                    if (obj) {
                        if (obj.type === 'group') {
                            collectObjects((obj as GroupObject).objectIds);
                            objectsToFlip.push(obj); // Also flip the group container position
                        } else {
                            objectsToFlip.push(obj);
                        }
                    }
                });
            };
            
            collectObjects(selectedObjectInfo.objectIds);

            const processedIds = new Set<string>();

            objectsToFlip.forEach(obj => {
                if (processedIds.has(obj.id)) return;
                processedIds.add(obj.id);

                if (direction === 'horizontal') {
                    // Flip X around group center
                    // NewX = CenterX - (OldX - CenterX) - Width = 2*CenterX - OldX - Width
                    obj.x = 2 * centerX - obj.x - obj.width;
                    obj.skewX = -(obj.skewX || 0);
                    obj.skewY = -(obj.skewY || 0);
                    obj.rotation = -obj.rotation;
                    
                    // Geometry flip for point-based objects
                    if (obj.type === 'polygon') {
                        (obj as PolygonObject).points.forEach(p => {
                            const flipPt = (pt: Point) => { pt[0] = 2 * centerX - pt[0]; };
                            flipPt(p.anchor); flipPt(p.handle1); flipPt(p.handle2);
                        });
                    } else if (obj.type === 'path' || obj.type === 'flow-guide') {
                        (obj as PathObject).points.forEach(p => { p[0] = 2 * centerX - p[0]; });
                    } else if (obj.type === 'line') {
                        const l = obj as LineObject;
                        l.x1 = 2 * centerX - l.x1;
                        l.x2 = 2 * centerX - l.x2;
                    } else if (obj.type === 'measurement') {
                        const m = obj as MeasurementObject;
                        m.x1 = 2 * centerX - m.x1;
                        m.x2 = 2 * centerX - m.x2;
                    } else if (['shape', 'text', 'image', 'generic-path', 'path-group'].includes(obj.type)) {
                        // For complex objects, toggle flipX to mirror content
                        obj.flipX = !obj.flipX;
                    }
                } else {
                    // Flip Y
                    obj.y = 2 * centerY - obj.y - obj.height;
                    obj.skewX = -(obj.skewX || 0);
                    obj.skewY = -(obj.skewY || 0);
                    obj.rotation = -obj.rotation;

                    if (obj.type === 'polygon') {
                        (obj as PolygonObject).points.forEach(p => {
                            const flipPt = (pt: Point) => { pt[1] = 2 * centerY - pt[1]; };
                            flipPt(p.anchor); flipPt(p.handle1); flipPt(p.handle2);
                        });
                    } else if (obj.type === 'path' || obj.type === 'flow-guide') {
                        (obj as PathObject).points.forEach(p => { p[1] = 2 * centerY - p[1]; });
                    } else if (obj.type === 'line') {
                        const l = obj as LineObject;
                        l.y1 = 2 * centerY - l.y1;
                        l.y2 = 2 * centerY - l.y2;
                    } else if (obj.type === 'measurement') {
                        const m = obj as MeasurementObject;
                        m.y1 = 2 * centerY - m.y1;
                        m.y2 = 2 * centerY - m.y2;
                    } else if (['shape', 'text', 'image', 'generic-path', 'path-group'].includes(obj.type)) {
                        // For complex objects, toggle flipY to mirror content
                        obj.flipY = !obj.flipY;
                    }
                }
            });
        }));
    }, [selectedObjects, selectedObjectInfo, setAppState]);

    const handleSelectObjectsByFill = useCallback((fill: string | Gradient) => {
        if (!activeLayerId) return;
        const layer = layers.find(l => l.id === activeLayerId);
        if (layer) {
            const ids = layer.objects.filter(o => JSON.stringify(o.fill) === JSON.stringify(fill)).map(o => o.id);
            setSelectedObjectInfo({ layerId: activeLayerId, objectIds: ids });
        }
    }, [activeLayerId, layers, setSelectedObjectInfo]);

    const handleConvertObjectToPath = useCallback(() => {
        const newSelectionIds: string[] = [];

        setAppState(produce((draft: AppState) => {
            if (!selectedObjectInfo) return;
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (!layer) return;

            const idsToConvert = [...selectedObjectInfo.objectIds];

            idsToConvert.forEach((id) => {
                const objIndex = layer.objects.findIndex(o => o.id === id);
                if (objIndex !== -1) {
                    const obj = layer.objects[objIndex];
                    const newPolys = convertObjectToPolygon(obj);
                    
                    if (newPolys && newPolys.length > 0) {
                        // If we got valid polygons, check for splitting behavior
                        if (newPolys.length === 1) {
                            // If single result, try to preserve original ID if desired, or let it be unique.
                            // For simplicity, we use the generated unique IDs.
                        }
                        
                        // Replace original object with the new polygons
                        layer.objects.splice(objIndex, 1, ...newPolys);
                        
                        newPolys.forEach(p => newSelectionIds.push(p.id));
                    } else {
                        // Keep original if conversion fails
                        newSelectionIds.push(obj.id);
                    }
                }
            });
        }));
        
        if (newSelectionIds.length > 0 && selectedObjectInfo) {
             setSelectedObjectInfo({ layerId: selectedObjectInfo.layerId, objectIds: newSelectionIds });
        }
        
        setActiveTool('node');
    }, [selectedObjectInfo, setAppState, setActiveTool, setSelectedObjectInfo]);

    const handleGroup = useCallback(() => {
        if (selectedObjects.length < 2 || !activeLayerId) return;
        const bounds = calculateGroupBounds(selectedObjects);
        
        const newGroupId = String(Date.now());

        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === activeLayerId);
            if (!layer) return;
            
            const newGroup: GroupObject = {
                id: newGroupId,
                type: 'group',
                objectIds: selectedObjects.map(o => o.id),
                x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                rotation: 0, skewX: 0, skewY: 0,
                fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 1,
                fillOpacity: 1, strokeOpacity: 1, blendMode: 'normal'
            };
            
            layer.objects.push(newGroup);
        }));

        // Select the new group so button states update
        setSelectedObjectInfo({ layerId: activeLayerId, objectIds: [newGroupId] });

    }, [selectedObjects, activeLayerId, setAppState, setSelectedObjectInfo]);

    const handleUngroup = useCallback(() => {
        if (!selectedObjectInfo) return;
        
        // Identify children to select after ungrouping
        const idsToSelect: string[] = [];
        
        selectedObjects.forEach(obj => {
            if (obj.type === 'group') {
                // Add children of the group being dissolved
                idsToSelect.push(...(obj as GroupObject).objectIds);
            } else {
                // Keep non-group items selected
                idsToSelect.push(obj.id);
            }
        });

        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === selectedObjectInfo.layerId);
            if (!layer) return;
            
            selectedObjectInfo.objectIds.forEach(id => {
                const obj = layer.objects.find(o => o.id === id);
                if (obj && obj.type === 'group') {
                    // Delete the group object from the layer
                    // (Children already exist in the layer list, group was just a container reference)
                    layer.objects = layer.objects.filter(o => o.id !== id);
                }
            });
        }));
        
        if (idsToSelect.length > 0) {
            setSelectedObjectInfo({ layerId: selectedObjectInfo.layerId, objectIds: idsToSelect });
        } else {
            setSelectedObjectInfo(null);
        }
    }, [selectedObjectInfo, selectedObjects, setAppState, setSelectedObjectInfo]);

    const handleAttachToPath = useCallback(() => {
        if (selectedObjects.length < 2 || !activeLayerId) return;
        
        // The last selected object is the path
        const pathObj = selectedObjects[selectedObjects.length - 1];
        
        if (!['path', 'generic-path', 'shape', 'polygon', 'line'].includes(pathObj.type)) return;

        const itemsToAttach = selectedObjects.slice(0, selectedObjects.length - 1);
        
        const newPathGroup: PathGroupObject = {
            id: String(Date.now()),
            type: 'path-group',
            pathId: pathObj.id,
            templateObjectIds: itemsToAttach.map(o => o.id),
            settings: {
                distributionMode: 'count',
                count: itemsToAttach.length,
                distance: 50,
                startOffset: 0,
                endOffset: 1,
                alignToPath: true,
                rotationOffset: 0,
                perpendicularOffset: 0
            },
            x: pathObj.x, y: pathObj.y, width: pathObj.width, height: pathObj.height,
            rotation: 0, skewX: 0, skewY: 0,
            fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 1,
            fillOpacity: 1, strokeOpacity: 1, blendMode: 'normal'
        };

        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === activeLayerId);
            if (layer) {
                layer.objects.push(newPathGroup);
            }
        }));
        setSelectedObjectInfo({ layerId: activeLayerId, objectIds: [newPathGroup.id] });

    }, [selectedObjects, activeLayerId, setAppState, setSelectedObjectInfo]);

    const handleApplyPathGroup = useCallback(() => {
        if (!selectedObjects[0] || selectedObjects[0].type !== 'path-group') return;
        const pathGroup = selectedObjects[0] as PathGroupObject;
        
        const layer = appState.layers.find(l => l.id === activeLayerId);
        if (!layer) return;

        const pathObject = layer.objects.find(o => o.id === pathGroup.pathId);
        const templateObjects = pathGroup.templateObjectIds.map(id => layer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];

        if (!pathObject || templateObjects.length === 0) return;

        const pathD = getSVGPathFromObject(pathObject);
        if (!pathD) return;

        const totalLength = getPathTotalLength(pathD);
        if (totalLength === 0) return;

        const { distributionMode, count, distance, startOffset, endOffset, alignToPath, rotationOffset = 0, perpendicularOffset = 0 } = pathGroup.settings;
        const pathStart = totalLength * Math.max(0, Math.min(1, startOffset));
        const pathEnd = totalLength * Math.max(0, Math.min(1, endOffset));
        const effectiveLength = Math.max(0, pathEnd - pathStart);
        
        const isPathClosed = pathD.trim().endsWith('Z') || pathD.trim().endsWith('z');
        const numInstances = distributionMode === 'count' ? count : (distance > 0 ? Math.floor(effectiveLength / distance) + 1 : 0);

        if (!Number.isFinite(numInstances) || numInstances < 0) return;

        const newObjects: VectorObject[] = [];

        for (let i = 0; i < numInstances; i++) {
            let lengthOnPath = 0;
            if (distributionMode === 'count') {
                let fraction = 0;
                if (numInstances > 1) {
                    fraction = i / (numInstances - 1);
                    if (isPathClosed) fraction = i / numInstances;
                } else {
                    fraction = 0.5;
                }
                lengthOnPath = pathStart + (fraction * effectiveLength);
            } else {
                lengthOnPath = pathStart + (i * distance);
            }
            
            if (lengthOnPath > pathEnd + 0.01) break;

            const posAndTan = getPointAndTangentAtLength(pathD, lengthOnPath);
            if (!posAndTan) continue;
            const { point, angle } = posAndTan;

            const template = templateObjects[i % templateObjects.length];
            
            const instanceObject = JSON.parse(JSON.stringify(template));
            instanceObject.id = String(Date.now() + Math.random()); 
            instanceObject.rotation = (alignToPath ? template.rotation + angle : template.rotation) + rotationOffset;

            // Calculate perpendicular offset
            const normalRad = (angle + 90) * Math.PI / 180;
            const offsetX = Math.cos(normalRad) * perpendicularOffset;
            const offsetY = Math.sin(normalRad) * perpendicularOffset;

            const dx = point[0] - (template.x + template.width / 2) + offsetX;
            const dy = point[1] - (template.y + template.height / 2) + offsetY;

            instanceObject.x += dx;
            instanceObject.y += dy;
            
            if (instanceObject.type === 'polygon') {
                instanceObject.points = (template as PolygonObject).points.map((p: any) => ({
                    anchor: [p.anchor[0] + dx, p.anchor[1] + dy],
                    handle1: [p.handle1[0] + dx, p.handle1[1] + dy],
                    handle2: [p.handle2[0] + dx, p.handle2[1] + dy],
                }));
            } else if ((instanceObject.type === 'path' || instanceObject.type === 'flow-guide')) {
                instanceObject.points = (template as PathObject).points.map((p: any) => [p[0] + dx, p[1] + dy]);
            } else if (instanceObject.type === 'line') {
                (instanceObject as LineObject).x1 += dx;
                (instanceObject as LineObject).y1 += dy;
                (instanceObject as LineObject).x2 += dx;
                (instanceObject as LineObject).y2 += dy;
            }
            
            newObjects.push(instanceObject);
        }

        // Apply updates
        setAppState(produce((draft: AppState) => {
            const l = draft.layers.find(l => l.id === activeLayerId);
            if (!l) return;
            
            // Remove the path group
            l.objects = l.objects.filter(o => o.id !== pathGroup.id);
            
            // Remove template objects
            l.objects = l.objects.filter(o => !pathGroup.templateObjectIds.includes(o.id));
            
            // Add new objects
            l.objects.push(...newObjects);
        }));

        // Select new objects
        setSelectedObjectInfo({ layerId: activeLayerId!, objectIds: newObjects.map(o => o.id) });

    }, [selectedObjects, appState.layers, activeLayerId, setAppState, setSelectedObjectInfo]);

    const handleBooleanOperation = useCallback((operation: 'unite' | 'subtract' | 'intersect' | 'exclude') => {
        const result = performBooleanOperation(selectedObjects, operation);
        if (result) {
            setAppState(produce((draft: AppState) => {
                const layer = draft.layers.find(l => l.id === selectedObjectInfo!.layerId);
                if (!layer) return;
                
                // Remove operands
                const operandIds = selectedObjects.map(o => o.id);
                layer.objects = layer.objects.filter(o => !operandIds.includes(o.id));
                
                // Add result
                layer.objects.push(result);
            }));
            setSelectedObjectInfo({ layerId: selectedObjectInfo!.layerId, objectIds: [result.id] });
        }
    }, [selectedObjects, selectedObjectInfo, setAppState, setSelectedObjectInfo]);

    return {
        selectedObjects,
        canGroup,
        canUngroup,
        canConvertToPath,
        isAttachToPathEnabled,
        uniqueFills,
        handleConvertObjectToPath,
        handleGroup,
        handleUngroup,
        handleUpdateSelectedObjects,
        handleDeleteSelectedObjects,
        handleCopySelectedObject,
        handlePasteObject,
        handleMoveSelectedObjects,
        handleReorderObject,
        handleAlignObjects,
        handleAlignToCanvas,
        handleSelectAll,
        handleFlipObject,
        handleSelectObjectsByFill,
        handleAttachToPath,
        handleApplyPathGroup,
        handleBooleanOperation,
    };
};