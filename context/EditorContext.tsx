

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { produce } from 'immer';
import type { AppState, InteractionState, HoverInfo, Layer, LayerSettings, VectorObject, VectorObjectType, ShapeType, MirrorMode, AlignmentType, PrimitivePatternData, Units, Gradient, BlendMode, TextObject, Point, SnapSettings, ActiveGuide, Guide } from '../types';
import { createInitialState } from '../lib/layer-helpers';
import { useHistoryState } from '../hooks/useHistoryState';
import { useEditorState } from '../hooks/useEditorState';
import { useLayerManager } from '../hooks/useLayerManager';
import { useObjectManager } from '../hooks/useObjectManager';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { useProjectManager } from '../hooks/useProjectManager';
import { usePatternTool } from '../hooks/usePatternTool';
import { useCanvasRenderData } from '../hooks/useCanvasRenderData';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useFontLoader } from '../hooks/useFontLoader';
import { loadGoogleFonts } from '../lib/utils';

/**
 * Interface defining the values provided by the EditorContext.
 */
interface EditorContextValue {
    // Editor State
    interaction: InteractionState;
    setInteraction: React.Dispatch<React.SetStateAction<InteractionState>>;
    editingMode: 'shape' | 'clip' | 'layer';
    setEditingMode: React.Dispatch<React.SetStateAction<'shape' | 'clip' | 'layer'>>;
    units: Units;
    setUnits: React.Dispatch<React.SetStateAction<Units>>;
    activeTool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure';
    setActiveTool: React.Dispatch<React.SetStateAction<'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure'>>;
    activeShapeType: ShapeType;
    setActiveShapeType: React.Dispatch<React.SetStateAction<ShapeType>>;
    clipboardObject: VectorObject | null;
    setClipboardObject: React.Dispatch<React.SetStateAction<VectorObject | null>>;
    viewState: { zoom: number; pan: { x: number; y: number } };
    setViewState: React.Dispatch<React.SetStateAction<{ zoom: number; pan: { x: number; y: number } }>>;
    mirrorMode: MirrorMode;
    setMirrorMode: React.Dispatch<React.SetStateAction<MirrorMode>>;
    mirrorGap: number;
    setMirrorGap: React.Dispatch<React.SetStateAction<number>>;
    selectedObjectInfo: { layerId: string; objectIds: string[] } | null;
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    handleToolChange: (tool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure') => void;
    toolSettings: Partial<VectorObject & TextObject>;
    handleUpdateToolSettings: (props: Partial<VectorObject>) => void;
    
    // Snapping
    snapSettings: SnapSettings;
    setSnapSettings: React.Dispatch<React.SetStateAction<SnapSettings>>;
    activeGuides: ActiveGuide[];
    cursorPos: Point | null;
    setCursorPos: React.Dispatch<React.SetStateAction<Point | null>>;

    // History / App State
    appState: AppState;
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    reset: (newState: AppState) => void;
    commitHistory: () => void;

    // Derived State
    activeLayer: Layer | undefined;
    activeLayerId: string | null;
    canvasConfig: { width: number; height: number };
    selectedObjects: VectorObject[];
    activeLayerHasObjects: boolean;
    uniqueFills: (string | Gradient)[];
    guides: Guide[];

    // Layer Manager
    updateLayerPattern: (layer: Layer, newSettings: Partial<LayerSettings>) => void;
    handleUpdateActiveLayer: (updater: (layer: Layer) => void) => void;
    handleUpdateActiveLayerSettings: (settings: Partial<LayerSettings>) => void;
    handleDensityImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleAddLayer: () => void;
    handleDuplicateLayer: () => void;
    handleDeleteLayer: (id: string) => void;
    handleToggleVisibility: (id: string) => void;
    handleRenameLayer: (id: string, newName: string) => void;
    handleLayerColorChange: (id: string, color: string) => void;
    handleLayerBlendModeChange: (id: string, blendMode: BlendMode) => void;
    handleSelectLayer: (id: string | null) => void;
    handleMoveLayer: (direction: 'up' | 'down') => void;
    handleToggleLockLayer: (id: string) => void;

    // Object Manager
    canGroup: boolean;
    canUngroup: boolean;
    canConvertToPath: boolean;
    isAttachToPathEnabled: boolean;
    selectionBounds: { x: number; y: number; width: number; height: number } | null;
    handleConvertObjectToPath: () => void;
    handleGroup: () => void;
    handleUngroup: () => void;
    handleUpdateSelectedObjects: (props: Partial<VectorObject>) => void;
    handleDeleteSelectedObjects: () => void;
    handleCopySelectedObject: () => void;
    handlePasteObject: () => void;
    handleMoveSelectedObjects: (dx: number, dy: number) => void;
    handleReorderObject: (direction: 'forward' | 'backward' | 'front' | 'back') => void;
    handleAlignObjects: (alignment: AlignmentType) => void;
    handleAlignToCanvas: (alignment: AlignmentType) => void;
    handleSelectAll: () => void;
    handleFlipObject: (direction: 'horizontal' | 'vertical') => void;
    handleSelectObjectsByFill: (fill: string | Gradient) => void;
    handleAttachToPath: () => void;
    handleApplyPathGroup: () => void;
    handleBooleanOperation: (operation: 'unite' | 'subtract' | 'intersect' | 'exclude') => void;

    // Project Manager
    projectManager: any;
    handleCanvasConfigChange: (config: { width: number; height: number }) => void;
    handleInitiateImport: (file: File, type: 'svg' | 'image', point?: Point) => void;

    // Canvas Interaction
    handleCanvasMouseDown: (point: [number, number], hitInfo: HoverInfo | null, altKey: boolean, shiftKey: boolean) => void;
    handleRulerMouseDown: (orientation: 'horizontal' | 'vertical', point: Point) => void;
    handleCanvasMouseMove: (point: [number, number] | null, shiftKey: boolean) => void;
    handleCanvasMouseUp: () => void;
    handleCanvasDoubleClick: (hitInfo: HoverInfo | null) => void;
    handleUpdateTextContent: (text: string) => void;
    handleFinishTextEditing: () => void;
    handleClearClipPath: () => void;

    // Pattern Tool
    patternPreviewData: PrimitivePatternData | null;
    handleApplyPatternFill: () => void;

    // Render Data
    renderData: { defs: React.ReactElement[]; layers: { layer: Layer; elements: any[] }[] };
    
    // Misc
    dpi: number;
}

const EditorContext = createContext<EditorContextValue | null>(null);

const RULER_BREADTH = 30;
const DPI = 96;

/**
 * The main provider component that wraps the application.
 * It initializes all state hooks (history, layers, objects, etc.) and combines them into the EditorContext.
 * This context acts as the central store for the entire vector editor.
 */
export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        interaction, setInteraction,
        densityImages, setDensityImages,
        editingMode, setEditingMode,
        units, setUnits,
        activeTool, setActiveTool,
        selectedObjectInfo, setSelectedObjectInfo,
        activeShapeType, setActiveShapeType,
        clipboardObject, setClipboardObject,
        viewState, setViewState,
        mirrorMode, setMirrorMode,
        mirrorGap, setMirrorGap,
        toolSettings, handleUpdateToolSettings,
        handleToolChange,
        snapSettings, setSnapSettings,
        activeGuides, setActiveGuides,
        cursorPos, setCursorPos,
    } = useEditorState();

    const { state: appState, setState: setAppState, undo, redo, canUndo, canRedo, reset, commit } = useHistoryState<AppState>(createInitialState());
    const { layers, activeLayerId, canvasConfig, guides } = appState;

    useFontLoader(layers);

    const activeLayer = useMemo(() => layers.find(l => l.id === activeLayerId), [layers, activeLayerId]);

    const {
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
    } = useLayerManager({
        setAppState,
        activeLayerId,
        selectedObjectInfo,
        setSelectedObjectInfo,
        setDensityImages
    });

    const {
        selectedObjects,
        canGroup,
        canUngroup,
        canConvertToPath,
        isAttachToPathEnabled,
        selectionBounds,
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
    } = useObjectManager({
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
        setActiveTool,
    });

    const projectManager = useProjectManager({
        appState,
        setAppState,
        reset,
        createInitialState,
        canUndo,
        setDensityImages,
        setInteraction,
        setSelectedObjectInfo,
        setEditingMode,
        setUnits,
        mirrorMode,
        mirrorGap,
        units
    });

    const { handleInitiateImport } = projectManager;

    const {
        patternPreviewData,
        handleApplyPatternFill
    } = usePatternTool({
        appState,
        setAppState,
        editingMode,
        selectedObjects,
        setSelectedObjectInfo,
        densityImages,
        updateLayerPattern,
    });

    const handleCanvasConfigChange = useCallback((config: { width: number; height: number; }) => {
        setAppState(produce((draft: AppState) => {
            draft.canvasConfig = config;
        }));
    }, [setAppState]);

    const {
        handleCanvasMouseDown,
        handleRulerMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        handleUpdateTextContent,
        handleFinishTextEditing,
        handleClearClipPath
    } = useCanvasInteraction({
        interaction, setInteraction, editingMode, appState, setAppState, activeLayer,
        selectedObjects, selectedObjectInfo, setSelectedObjectInfo, activeTool, setActiveTool,
        activeShapeType, mirrorMode, mirrorGap, handleUpdateActiveLayer,
        handleUpdateSelectedObjects, updateLayerPattern, loadGoogleFonts,
        toolSettings, handleInitiateImport,
        snapSettings, setActiveGuides,
        setCursorPos,
        commitHistory: commit
    });

    const handleCanvasDoubleClick = useCallback((hitInfo: HoverInfo | null) => {
        if (hitInfo?.type === 'object') {
            const { layerId, objectId } = hitInfo;
            const layer = layers.find(l => l.id === layerId);
            const object = layer?.objects.find(o => o.id === objectId);
            if (object?.type === 'text' && !layer?.isLocked) {
                setInteraction({ mode: 'editing_text', layerId, objectId });
                setSelectedObjectInfo({ layerId, objectIds: [objectId] });
            }
        }
    }, [layers, setInteraction, setSelectedObjectInfo]);

    useKeyboardShortcuts({
        undo,
        redo,
        handleCopySelectedObject,
        handlePasteObject,
        handleSelectAll,
        handleDeleteSelectedObjects,
        handleMoveSelectedObjects,
        handleFinishTextEditing,
        interaction,
        setInteraction,
        selectedObjectInfo,
        setSelectedObjectInfo,
        editingMode,
        setEditingMode,
        setActiveTool,
        setAppState
    });

    const renderData = useCanvasRenderData({ layers, canvasConfig, units, dpi: DPI });

    const contextValue: EditorContextValue = {
        interaction, setInteraction,
        editingMode, setEditingMode,
        units, setUnits,
        activeTool, setActiveTool,
        activeShapeType, setActiveShapeType,
        clipboardObject, setClipboardObject,
        viewState, setViewState,
        mirrorMode, setMirrorMode,
        mirrorGap, setMirrorGap,
        selectedObjectInfo, setSelectedObjectInfo,
        handleToolChange,
        toolSettings, handleUpdateToolSettings,
        
        snapSettings, setSnapSettings,
        activeGuides,
        cursorPos, setCursorPos,

        appState, setAppState, undo, redo, canUndo, canRedo, reset, commitHistory: commit,

        activeLayer, activeLayerId, canvasConfig, selectedObjects,
        activeLayerHasObjects: !!activeLayer && activeLayer.objects.length > 0,
        uniqueFills,
        guides,

        updateLayerPattern, handleUpdateActiveLayer, handleUpdateActiveLayerSettings, handleDensityImageChange,
        handleAddLayer, handleDuplicateLayer, handleDeleteLayer, handleToggleVisibility, handleRenameLayer,
        handleLayerColorChange, handleLayerBlendModeChange, handleSelectLayer, handleMoveLayer, handleToggleLockLayer,

        canGroup, canUngroup, canConvertToPath, isAttachToPathEnabled, selectionBounds,
        handleConvertObjectToPath, handleGroup, handleUngroup, handleUpdateSelectedObjects, handleDeleteSelectedObjects,
        handleCopySelectedObject, handlePasteObject, handleMoveSelectedObjects, handleReorderObject, handleAlignObjects,
        handleAlignToCanvas, handleSelectAll, handleFlipObject, handleSelectObjectsByFill, handleAttachToPath, handleApplyPathGroup,
        handleBooleanOperation,

        projectManager, handleCanvasConfigChange, handleInitiateImport,

        handleCanvasMouseDown, handleRulerMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasDoubleClick,
        handleUpdateTextContent, handleFinishTextEditing, handleClearClipPath,

        patternPreviewData, handleApplyPatternFill,

        renderData,
        dpi: DPI
    };

    return (
        <EditorContext.Provider value={contextValue}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
};