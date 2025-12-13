
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { produce } from 'immer';
import type { AppState, PrimitivePatternData, VectorObject, Layer, LayerSettings, Point, PolygonVertex, BlendMode, ShapeObject, TextObject, GenericPathObject } from '../types';
import { generatePattern } from '../lib/pattern-generator';
import { getObjectVisualBounds, calculateGroupBounds, parseVoronoiPathToPoints, calculatePolygonBounds, calculateGenericPathBounds } from '../lib/geometry';
import { measureText } from '../lib/text-utils';
import { performBooleanOperation } from '../lib/boolean-operations';

interface UsePatternToolProps {
    appState: AppState;
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
    editingMode: 'shape' | 'clip' | 'layer';
    selectedObjects: VectorObject[];
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    densityImages: Record<string, HTMLImageElement>;
    updateLayerPattern: (layer: Layer, newSettings: Partial<LayerSettings>) => void;
}

/**
 * Custom hook for generating and applying patterns to vector objects.
 * Manages the live preview generation for patterns based on layer settings and selected objects.
 * Handles the application of the generated pattern geometry into the active layer, 
 * replacing or overlaying the original object, and applying clipping via boolean operations if necessary.
 *
 * @param props - The hook properties.
 * @param props.appState - The current application state.
 * @param props.setAppState - Function to update application state.
 * @param props.editingMode - The current editing mode.
 * @param props.selectedObjects - The currently selected objects to apply patterns to.
 * @param props.setSelectedObjectInfo - Function to update selection.
 * @param props.densityImages - Map of loaded density images.
 * @param props.updateLayerPattern - Function to reset pattern settings after application.
 * @returns An object containing the pattern preview data and the apply handler.
 */
export const usePatternTool = ({
    appState,
    setAppState,
    editingMode,
    selectedObjects,
    setSelectedObjectInfo,
    densityImages,
    updateLayerPattern,
}: UsePatternToolProps) => {

    const [patternPreviewData, setPatternPreviewData] = useState<PrimitivePatternData | null>(null);
    const previewTimeoutRef = useRef<number | null>(null);

    const activeLayer = appState.layers.find(l => l.id === appState.activeLayerId);

    // Effect for live pattern preview
    useEffect(() => {
        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }

        if (editingMode === 'shape' && selectedObjects.length > 0 && activeLayer && activeLayer.settings.patternType !== 'none') {
            previewTimeoutRef.current = window.setTimeout(() => {
                const bounds = selectedObjects.length > 1 ? calculateGroupBounds(selectedObjects) : getObjectVisualBounds(selectedObjects[0]);
                if (bounds.width <= 0 || bounds.height <= 0) {
                    setPatternPreviewData(null);
                    return;
                };
                const primitiveData = generatePattern({
                    patternSettings: activeLayer.settings,
                    bounds: bounds,
                    densityImages,
                    seed: activeLayer.settings.seed,
                    objects: activeLayer.objects,
                });
                setPatternPreviewData(primitiveData);
            }, 250);
        } else {
            setPatternPreviewData(null);
        }

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [selectedObjects, activeLayer, densityImages, editingMode]);

    const handleApplyPatternFill = useCallback(() => {
        if (!activeLayer || selectedObjects.length === 0) return;

        const appliedPatternType = activeLayer.settings.patternType;
        const isGeneratorType = ['box-joint', 'gears', 'jigsaw', 'maze', 'living-hinge', 'spirograph', 'guilloche'].includes(appliedPatternType);

        // For now, only support single object fill to ensure clipping is well-defined
        if (selectedObjects.length > 1) {
            alert("Pattern fill currently supports only single object selection.");
            return;
        }
        const clipObject = selectedObjects[0];
        const allNewObjects: VectorObject[] = [];
        const bounds = getObjectVisualBounds(clipObject);
        
        // Use the live preview data if available, otherwise generate it fresh.
        const primitiveData = patternPreviewData || generatePattern({
            patternSettings: activeLayer.settings,
            bounds: bounds,
            densityImages,
            seed: activeLayer.settings.seed,
            objects: activeLayer.objects,
        });

        const defaultProps = {
            opacity: 1,
            fillOpacity: 1,
            strokeOpacity: 1,
            blendMode: 'normal' as BlendMode
        };


        if (primitiveData) {
            const baseProps = {
                rotation: 0,
                skewX: 0, skewY: 0,
                fill: 'none',
                stroke: activeLayer.color || '#ffffff',
                strokeWidth: activeLayer.settings.strokeWidth,
                ...defaultProps
            };

            const newObjectsForThisShape: VectorObject[] = [];

             if (primitiveData.type === 'voronoi') {
                primitiveData.paths.forEach((d, i) => {
                    const points = parseVoronoiPathToPoints(d);
                    if (points.length < 3) return;
                    const polygonPoints: PolygonVertex[] = points.map(p => ({ anchor: p, handle1: p, handle2: p }));
                    const bounds = calculatePolygonBounds(polygonPoints);
                    newObjectsForThisShape.push({
                        id: String(Date.now() + i + Math.random()),
                        type: 'polygon',
                        points: polygonPoints,
                        isClosed: true,
                        ...bounds,
                        ...baseProps
                    });
                });
            } else if ('circles' in primitiveData) {
                primitiveData.circles.forEach((c, i) => {
                    newObjectsForThisShape.push({
                        id: String(Date.now() + i + Math.random()),
                        type: 'shape',
                        shapeType: 'ellipse',
                        x: c.cx - c.r,
                        y: c.cy - c.r,
                        width: c.r * 2,
                        height: c.r * 2,
                        rotation: 0,
                        skewX: 0, skewY: 0,
                        fill: activeLayer.color || '#ffffff',
                        stroke: 'none',
                        strokeWidth: 0,
                        ...defaultProps
                    });
                });
            } else if (primitiveData.type === 'words') {
               primitiveData.words.forEach((w, i) => {
                   const { width, height } = measureText(w.text, w.fontSize, w.fontFamily, w.fontWeight);
                   newObjectsForThisShape.push({
                       id: String(Date.now() + i + Math.random()),
                       type: 'text',
                       x: w.x,
                       y: w.y,
                       width,
                       height,
                       rotation: w.rotation,
                       skewX: 0, skewY: 0,
                       text: w.text,
                       fontSize: w.fontSize,
                       fontFamily: w.fontFamily,
                       fontWeight: w.fontWeight,
                       fill: activeLayer.color || '#ffffff',
                       stroke: 'none',
                       strokeWidth: 0,
                       ...defaultProps
                   });
               });
            } else {
                const FILLED_PATH_PATTERNS: (PrimitivePatternData['type'])[] = ['truchet', 'sine'];
                const isFilled = FILLED_PATH_PATTERNS.includes(primitiveData.type);

                primitiveData.paths.forEach((d, i) => {
                    const bounds = calculateGenericPathBounds(d);
                    const objectProps = {
                        rotation: 0,
                        skewX: 0, skewY: 0,
                        fill: isFilled ? activeLayer.color || '#ffffff' : 'none',
                        stroke: isFilled ? 'none' : activeLayer.color || '#ffffff',
                        strokeWidth: isFilled ? 0 : activeLayer.settings.strokeWidth,
                        ...defaultProps
                    };
                    newObjectsForThisShape.push({
                        id: String(Date.now() + i + Math.random()),
                        type: 'generic-path',
                        d,
                        ...bounds,
                        ...objectProps
                    });
                });
            }
            
            if (isGeneratorType) {
                // For generators like Box Joints, do not clip. The selection shape just defines the start position.
                allNewObjects.push(...newObjectsForThisShape);
            } else {
                // For Fill patterns, clip them against the selected object using exact boolean operations
                newObjectsForThisShape.forEach(subjectObj => {
                    // Perform exact boolean intersection
                    // subjectObj is the "bottom" object (the pattern element)
                    // clipObject is the "top" object (the clipping mask/shape)
                    // 'intersect' keeps the part of subjectObj that is inside clipObject
                    const result = performBooleanOperation([subjectObj, clipObject], 'intersect');
                    
                    if (result) {
                        // performBooleanOperation returns a GenericPathObject with the visual properties of subjectObj
                        // Assign a unique ID
                        result.id = String(Date.now() + Math.random());
                        allNewObjects.push(result);
                    }
                });
            }
        }
        
        const strokeObject = (clipObject.stroke && clipObject.stroke !== 'none' && clipObject.strokeWidth > 0)
            ? produce(clipObject, draft => { draft.fill = 'none'; })
            : null;

        if (allNewObjects.length === 0 && !strokeObject) return;

        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === draft.activeLayerId);
            if (!layer) return;

            const originalObjectIds = new Set(selectedObjects.map(o => o.id));

            // Remove original objects that were used for filling
            let objects = layer.objects.filter(o => !originalObjectIds.has(o.id));

            // If flow-field pattern was applied, remove any flow guide objects from the layer
            if (appliedPatternType === 'flow-field') {
                objects = objects.filter(o => o.type !== 'flow-guide');
            }

            // Add the newly generated pattern objects
            objects.push(...allNewObjects);
            
            // Add the stroke of the original object back on top
            if (strokeObject) {
                objects.push(strokeObject);
            }

            // Update the layer's objects
            layer.objects = objects;

            // Reset pattern type
            updateLayerPattern(layer, { patternType: 'none' });
        }));
        
        const newSelectionIds = allNewObjects.map(o => o.id);
        if (strokeObject) {
            newSelectionIds.push(strokeObject.id);
        }
        // Select the new objects
        setSelectedObjectInfo({ layerId: activeLayer.id, objectIds: newSelectionIds });
        setPatternPreviewData(null); // Clear preview after applying
        
    }, [activeLayer, selectedObjects, densityImages, setAppState, patternPreviewData, updateLayerPattern, setSelectedObjectInfo]);

    return {
        patternPreviewData,
        handleApplyPatternFill
    };
};