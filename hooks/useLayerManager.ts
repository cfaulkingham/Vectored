
import React, { useCallback } from 'react';
import { produce } from 'immer';
import type { AppState, Layer, BlendMode, LayerSettings, VectorObject } from '../types';
import { createNewLayer } from '../lib/layer-helpers';

interface UseLayerManagerProps {
    /** Function to update the global application state */
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
    /** The ID of the currently active layer */
    activeLayerId: string | null;
    /** Metadata for the currently selected object */
    selectedObjectInfo: { layerId: string; objectIds: string[] } | null;
    /** Setter for selected object info */
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    /** Function to update loaded density images registry */
    setDensityImages: React.Dispatch<React.SetStateAction<Record<string, HTMLImageElement>>>;
}

/**
 * Custom hook for managing layers within the application state.
 * Handles creation, deletion, duplication, reordering, visibility toggling,
 * renaming, and property updates (settings, color, blend mode) for layers.
 * It encapsulates all logic related to the layer stack.
 *
 * @param props - The hook properties.
 * @returns An object containing handlers for various layer operations.
 */
export const useLayerManager = ({ setAppState, activeLayerId, selectedObjectInfo, setSelectedObjectInfo, setDensityImages }: UseLayerManagerProps) => {
    
    /**
     * Updates specific pattern settings for a layer.
     * Performs cleanup (e.g., removing flow guides) if the pattern type changes.
     */
    const updateLayerPattern = useCallback((layer: Layer, newSettings: Partial<LayerSettings>) => {
        const oldPatternType = layer.settings.patternType;
        Object.assign(layer.settings, newSettings);
        if (oldPatternType === 'flow-field' && newSettings.patternType && newSettings.patternType !== 'flow-field') {
            layer.objects = layer.objects.filter(obj => obj.type !== 'flow-guide');
        }
    }, []);

    /**
     * Generic helper to update the currently active layer.
     * Uses a callback updater for flexibility.
     */
    const handleUpdateActiveLayer = useCallback((updater: (layer: Layer) => void) => {
        setAppState(produce((draft: AppState) => {
            if (!draft.activeLayerId) return;
            const layer = draft.layers.find(l => l.id === draft.activeLayerId);
            if (layer) {
                updater(layer);
            }
        }));
    }, [setAppState]);

    /**
     * Updates the settings of the active layer.
     * Also handles side effects like clearing fills on selected objects when a pattern is applied.
     */
    const handleUpdateActiveLayerSettings = useCallback((newSettings: Partial<LayerSettings>) => {
        setAppState(produce((draft: AppState) => {
            if (!draft.activeLayerId) return;
            const layer = draft.layers.find(l => l.id === draft.activeLayerId);
            if (!layer) return;

            // Apply new settings
            updateLayerPattern(layer, newSettings);

            // If a new pattern is being selected, clear the fill of any selected objects
            if (newSettings.patternType && newSettings.patternType !== 'none' && selectedObjectInfo && selectedObjectInfo.layerId === layer.id) {
                selectedObjectInfo.objectIds.forEach(id => {
                    const obj = layer.objects.find(o => o.id === id);
                    if (obj) obj.fill = 'none';
                });
            }
        }));
    }, [updateLayerPattern, selectedObjectInfo, setAppState]);

    /**
     * Handles file input change for loading a density image.
     * Reads the file as a Data URL and updates the layer settings and image registry.
     */
    const handleDensityImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeLayerId) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                if (url) {
                    handleUpdateActiveLayerSettings({ densityImageURL: url });
                    const img = new Image();
                    img.onload = () => setDensityImages(prev => ({ ...prev, [url]: img }));
                    img.src = url;
                }
            };
            reader.readAsDataURL(file);
        }
    }, [activeLayerId, handleUpdateActiveLayerSettings, setDensityImages]);

    /**
     * Creates a new layer and sets it as active.
     */
    const handleAddLayer = useCallback(() => {
        setAppState(produce((draft: AppState) => {
            const activeLayer = draft.layers.find((l: Layer) => l.id === draft.activeLayerId);
            const newLayer = createNewLayer();
            newLayer.name = `Layer ${draft.layers.length + 1}`;
            newLayer.color = activeLayer?.color || '#000000'; // Start with a sensible default
            draft.layers.push(newLayer);
            draft.activeLayerId = newLayer.id;
        }));
    }, [setAppState]);

    /**
     * Duplicates the currently active layer, including settings and objects.
     */
    const handleDuplicateLayer = useCallback(() => {
        setAppState(produce((draft: AppState) => {
            const activeLayer = draft.layers.find((l: Layer) => l.id === draft.activeLayerId);
            if (!activeLayer) return;
            const newLayer = { ...activeLayer, id: String(Date.now()), name: `${activeLayer.name} Copy`, settings: { ...activeLayer.settings, seed: Math.floor(Math.random() * 100000) }, isLocked: false };
            const activeIndex = draft.layers.findIndex((l: Layer) => l.id === draft.activeLayerId);
            draft.layers.splice(activeIndex + 1, 0, newLayer);
            draft.activeLayerId = newLayer.id;
        }));
    }, [setAppState]);

    /**
     * Deletes a layer by ID.
     * Prevents deleting the last remaining layer.
     */
    const handleDeleteLayer = useCallback((idToDelete: string) => {
        setAppState(produce((draft: AppState) => {
            if (draft.layers.length <= 1) return;
            const activeIndex = draft.layers.findIndex((l: Layer) => l.id === idToDelete);
            if (activeIndex === -1) return;
            draft.layers.splice(activeIndex, 1);
            if (draft.activeLayerId === idToDelete) {
                const newActiveIndex = Math.max(0, activeIndex - 1);
                draft.activeLayerId = draft.layers[newActiveIndex]?.id || null;
            }
        }));
    }, [setAppState]);

    /**
     * Toggles the visibility of a layer.
     */
    const handleToggleVisibility = useCallback((id: string) => {
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find((l: Layer) => l.id === id);
            if (layer) layer.visible = !layer.visible;
        }));
    }, [setAppState]);

    /**
     * Renames a layer.
     */
    const handleRenameLayer = useCallback((id: string, newName: string) => {
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find((l: Layer) => l.id === id);
            if (layer) layer.name = newName;
        }));
    }, [setAppState]);

    /**
     * Updates the default stroke color for a layer.
     */
    const handleLayerColorChange = useCallback((id: string, color: string) => {
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find((l: Layer) => l.id === id);
            if (layer) layer.color = color;
        }));
    }, [setAppState]);

    /**
     * Updates the blend mode for a layer.
     */
    const handleLayerBlendModeChange = useCallback((id: string, blendMode: BlendMode) => {
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find((l: Layer) => l.id === id);
            if (layer) layer.blendMode = blendMode;
        }));
    }, [setAppState]);

    /**
     * Sets the active layer ID and clears object selection.
     */
    const handleSelectLayer = useCallback((id: string | null) => {
        setAppState(produce((draft: AppState) => {
            draft.activeLayerId = id;
        }));
        setSelectedObjectInfo(null);
    }, [setAppState, setSelectedObjectInfo]);

    /**
     * Moves the active layer up or down in the stack.
     */
    const handleMoveLayer = useCallback((direction: 'up' | 'down') => {
        setAppState(produce((draft: AppState) => {
            if (!draft.activeLayerId) return;
            const fromIndex = draft.layers.findIndex((l: Layer) => l.id === draft.activeLayerId);
            if (fromIndex === -1) return;
            const [movedLayer] = draft.layers.splice(fromIndex, 1);
            switch (direction) {
                case 'up': draft.layers.splice(Math.min(draft.layers.length, fromIndex + 1), 0, movedLayer); break;
                case 'down': draft.layers.splice(Math.max(0, fromIndex - 1), 0, movedLayer); break;
            }
        }));
    }, [setAppState]);

    /**
     * Toggles the lock state of a layer.
     */
    const handleToggleLockLayer = useCallback((layerId: string) => {
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find((l: Layer) => l.id === layerId);
            if (layer) {
                layer.isLocked = !layer.isLocked;
            }
        }));
    }, [setAppState]);

    /**
     * Complete replacement for 'layers' used by drag-and-drop operations.
     */
    const handleSetLayers = useCallback((newLayers: Layer[]) => {
        setAppState(produce((draft: AppState) => {
            draft.layers = newLayers as typeof draft.layers;
        }));
    }, [setAppState]);

    /**
     * Updates an object property directly (visibility, locking, naming, style)
     */
    const handleUpdateObjectProperty = useCallback(<K extends keyof VectorObject>(
        layerId: string, 
        objectId: string, 
        property: K | string, 
        value: any
    ) => {
        setAppState(produce((draft: AppState) => {
            const layer = draft.layers.find(l => l.id === layerId);
            if (!layer) return;
            const obj = layer.objects.find(o => o.id === objectId);
            if (obj) {
                (obj as any)[property] = value;
            }
        }));
    }, [setAppState]);

    return {
        updateLayerPattern,
        handleUpdateActiveLayer,
        handleUpdateActiveLayerSettings,
        handleDensityImageChange,
        handleAddLayer,
        handleDuplicateLayer,
        handleDeleteLayer,
        handleToggleVisibility,
        handleRenameLayer,
        handleLayerColorChange,
        handleLayerBlendModeChange,
        handleSelectLayer,
        handleMoveLayer,
        handleToggleLockLayer,
        handleSetLayers,
        handleUpdateObjectProperty
    };
};
