import React, { useState, useRef, useCallback } from 'react';
import { Accordion, AccordionItem } from './controls/Accordion';
import LayerTransformControls from './controls/LayerTransformControls';
import LayersPanel from './controls/LayersPanel';
import ClipPathControls from './controls/ClipPathControls';
import AlignControls from './controls/AlignControls';
import { useEditor } from '../context/EditorContext';
import { ShapeControls } from './controls/ShapeControls';
import SymmetryControls from './controls/SymmetryControls';
import PatternBrushControls from './controls/PatternBrushControls';
import PathGroupControls from './controls/PathGroupControls';
import { ToolPropertiesControls } from './controls/ToolPropertiesControls';
import { BooleanControls } from './controls/BooleanControls'; 
import type { PathGroupObject, VectorObject, MeasurementObject } from '../types';
import { ClipIcon, LayersIcon, SelectIcon, ImageIcon, NestIcon } from './controls/Icons';
import { MeasurementControls } from './controls/MeasurementControls';

const isSelectionFillable = (selectedObjects: VectorObject[]): boolean => {
    if (selectedObjects.length !== 1) { return false; }
    const object = selectedObjects[0];
    if (object.type === 'polygon') { return object.isClosed; }
    if (object.type === 'shape') { if (object.shapeType === 'ring') { return false; } return true; }
    if (object.type === 'generic-path') {
        const d = object.d.trim();
        if (!d.endsWith('Z') && !d.endsWith('z')) { return false; }
        const movetoCount = (d.match(/M|m/g) || []).length;
        return movetoCount === 1;
    }
    return false;
};

/**
 * The Right Sidebar component.
 * Acts as the primary property inspector and control panel for the application.
 * It dynamically renders controls based on the current selection, active tool, and editing mode.
 * Includes Layers, Object Properties, Alignment, and specific tool settings.
 * Features a resizable pane.
 */
const RightSidebar: React.FC = () => {
    const editor = useEditor();
    const {
        appState, activeLayer, activeLayerId, editingMode, setEditingMode, selectedObjects,
        handleUpdateActiveLayer, handleClearClipPath,
        handleDeleteLayer, handleSelectLayer, handleRenameLayer, handleToggleVisibility, handleLayerColorChange, handleLayerBlendModeChange,
        handleMoveLayer, handleToggleLockLayer, handleAddLayer, handleDuplicateLayer, handleSetLayers, handleUpdateObjectProperty,
        activeTool, handleToolChange,
        handleUpdateSelectedObjects, handleDeleteSelectedObjects, handleCopySelectedObject, handlePasteObject, clipboardObject,
        activeShapeType, setActiveShapeType,
        handleReorderObject, handleAlignObjects, handleAlignToCanvas, handleFlipObject,
        handleSelectAll,
        mirrorMode, setMirrorMode, mirrorGap, setMirrorGap,
        uniqueFills, handleSelectObjectsByFill, activeLayerHasObjects,
        handleApplyPathGroup,
        handleUpdateActiveLayerSettings, handleDensityImageChange, handleApplyPatternFill,
        handleGroup, handleUngroup, canGroup, canUngroup, handleAttachToPath, isAttachToPathEnabled,
        handleConvertObjectToPath, canConvertToPath,
        toolSettings, handleUpdateToolSettings,
        handleBooleanOperation, 
        dpi,
        units,
        projectManager, // Added to access Nesting trigger
        setSelectedObjectInfo,
    } = editor;


    const [width, setWidth] = useState(320);
    const sidebarRef = useRef<HTMLElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!sidebarRef.current) return;
        e.preventDefault();
        const startWidth = sidebarRef.current.offsetWidth;
        const startX = e.clientX;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth - (moveEvent.clientX - startX);
            if (newWidth >= 280 && newWidth <= 600) {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, []);

    const { layers } = appState;

    if (!activeLayer) {
        return <aside className="w-80 bg-slate-900/95 p-4 flex-shrink-0 border-l border-slate-800/50" />;
    }
    
    const isPathGroupSelected = selectedObjects.length === 1 && selectedObjects[0].type === 'path-group';
    const isMeasurementSelected = selectedObjects.length === 1 && selectedObjects[0].type === 'measurement';
    const isBrushActive = activeTool === 'pattern-brush';
    const isDrawingTool = ['shape', 'polygon', 'path', 'line', 'text', 'measure'].includes(activeTool);

    // Helper to render properties content based on mode and selection
    const renderPropertiesContent = () => {
        const items = [];

        // 1. Layers Panel (Always present)
        items.push(
            <AccordionItem title="Layers" defaultOpen={true} key="layers">
                <LayersPanel
                    layers={layers}
                    activeLayerId={activeLayerId}
                    onSelectLayer={handleSelectLayer}
                    onAddLayer={handleAddLayer}
                    onDuplicateLayer={handleDuplicateLayer}
                    onDeleteLayer={handleDeleteLayer}
                    onToggleVisibility={handleToggleVisibility}
                    onRenameLayer={handleRenameLayer}
                    onLayerColorChange={handleLayerColorChange}
                    onLayerBlendModeChange={handleLayerBlendModeChange}
                    onMoveLayer={handleMoveLayer}
                    onToggleLockLayer={handleToggleLockLayer}
                    editingMode={editingMode}
                    onSetLayers={handleSetLayers}
                    onUpdateObjectProperty={handleUpdateObjectProperty}
                    selectedObjects={selectedObjects}
                    setSelectedObjects={setSelectedObjectInfo}
                />
            </AccordionItem>
        );

        // 2. Mode Specific Properties
        if (editingMode === 'layer') {
            items.push(
                <AccordionItem title="Layer Properties" defaultOpen={true} key="layer-props">
                    <LayerTransformControls activeLayer={activeLayer} onUpdateActiveLayer={handleUpdateActiveLayer} />
                </AccordionItem>
            );
        } else if (editingMode === 'clip') {
            items.push(
                <AccordionItem title="Clip Path Properties" defaultOpen={true} key="clip-props">
                    <ClipPathControls 
                        activeLayer={activeLayer} 
                        onUpdateActiveLayer={handleUpdateActiveLayer} 
                        onClearClipPath={handleClearClipPath} 
                        setEditingMode={setEditingMode} 
                    />
                </AccordionItem>
            );
        } else if (editingMode === 'shape') {
            // Shape/Object Mode
            if (selectedObjects.length > 0) {
                // Selection Properties
                if (isPathGroupSelected) {
                    items.push(
                        <AccordionItem title="Path Group Properties" defaultOpen={true} key="path-group-props">
                            <PathGroupControls 
                                object={selectedObjects[0] as PathGroupObject}
                                onUpdateSelectedObjects={handleUpdateSelectedObjects as (props: Partial<PathGroupObject>) => void}
                                onApply={handleApplyPathGroup}
                            />
                        </AccordionItem>
                    );
                } else if (isMeasurementSelected) {
                    items.push(
                        <AccordionItem title="Measurement Properties" defaultOpen={true} key="measurement-props">
                            <MeasurementControls 
                                object={selectedObjects[0] as MeasurementObject}
                                onUpdate={handleUpdateSelectedObjects as (props: Partial<MeasurementObject>) => void}
                            />
                        </AccordionItem>
                    );
                } else {
                    items.push(
                        <AccordionItem title="Object Properties" defaultOpen={true} key="object-props">
                            <ShapeControls
                                activeTool={activeTool}
                                onToolChange={handleToolChange}
                                selectedObjects={selectedObjects}
                                onUpdateSelectedObjects={handleUpdateSelectedObjects}
                                onDeleteSelectedObjects={handleDeleteSelectedObjects}
                                onCopySelectedObject={handleCopySelectedObject}
                                onPasteObject={handlePasteObject}
                                clipboardObject={clipboardObject}
                                onReorderObject={handleReorderObject}
                                onAlignObjects={handleAlignObjects}
                                onAlignToCanvas={handleAlignToCanvas}
                                onFlip={handleFlipObject}
                                activeLayer={activeLayer}
                                activeShapeType={activeShapeType}
                                onActiveShapeTypeChange={setActiveShapeType}
                                display="properties"
                                onSelectAll={handleSelectAll}
                                uniqueFills={uniqueFills}
                                onSelectObjectsByFill={handleSelectObjectsByFill}
                                activeLayerHasObjects={activeLayerHasObjects}
                                onUpdateActiveLayerSettings={handleUpdateActiveLayerSettings}
                                onDensityImageChange={handleDensityImageChange}
                                onApplyPatternFill={handleApplyPatternFill}
                                layers={layers}
                                onUpdateActiveLayer={handleUpdateActiveLayer}
                                canApplyPattern={isSelectionFillable(selectedObjects)}
                                onGroup={handleGroup}
                                onUngroup={handleUngroup}
                                canGroup={canGroup}
                                canUngroup={canUngroup}
                                dpi={dpi}
                                units={units}
                                onInitiateTrace={projectManager.handleInitiateTrace}
                            />
                        </AccordionItem>
                    );
                }

                if (!isMeasurementSelected) {
                    // Path Operations (Boolean + Convert/Attach)
                    items.push(
                        <AccordionItem title="Path Operations" defaultOpen={true} key="boolean-ops">
                            <BooleanControls 
                                onBooleanOperation={handleBooleanOperation} 
                                canOperateBoolean={selectedObjects.length >= 2}
                                onAttachToPath={handleAttachToPath}
                                isAttachToPathEnabled={isAttachToPathEnabled}
                                onConvertObjectToPath={handleConvertObjectToPath}
                                canConvertToPath={canConvertToPath}
                            />
                        </AccordionItem>
                    );
                }

                items.push(
                    <AccordionItem title="Arrange & Align" defaultOpen={false} key="align-props">
                        <AlignControls
                            onAlign={handleAlignObjects}
                            onAlignToCanvas={handleAlignToCanvas}
                            onReorderObject={handleReorderObject}
                            onFlip={handleFlipObject}
                            selectionCount={selectedObjects.length}
                            isSingleSelection={selectedObjects.length === 1}
                            isAtBack={activeLayer.objects.findIndex(o => o.id === selectedObjects[0]?.id) === 0}
                            isAtFront={activeLayer.objects.findIndex(o => o.id === selectedObjects[0]?.id) === activeLayer.objects.length - 1}
                            onGroup={handleGroup}
                            onUngroup={handleUngroup}
                            canGroup={canGroup}
                            canUngroup={canUngroup}
                        />
                    </AccordionItem>
                );
            } else {
                // Tool Options (No Selection)
                if (activeTool === 'node') {
                    const hasPolygons = activeLayer?.objects.some(o => o.type === 'polygon');
                    if (!hasPolygons) {
                        items.push(
                            <div className="p-4 text-center text-slate-500 text-xs" key="node-tool-hint">
                                Use the pen tool to create a path first.
                            </div>
                        );
                    } else {
                        items.push(
                            <div className="p-4 text-center text-slate-500 text-xs" key="node-tool-select-hint">
                                Select a polygon to edit its nodes.
                            </div>
                        );
                    }
                } else if (activeTool === 'select') {
                    if (activeLayerHasObjects) {
                        items.push(
                            <div className="p-1 text-center space-y-3" key="select-tool-options">
                                <p className="text-slate-500 text-xs">No object selected.</p>
                                <button onClick={handleSelectAll} className="w-full bg-slate-800 text-slate-300 font-semibold py-2 rounded-lg transition-colors duration-200 hover:bg-slate-700 border border-slate-700 text-xs">Select All</button>
                            </div>
                        );
                    } else {
                        items.push(
                            <div className="p-1 text-center text-slate-500 text-xs" key="empty-layer-msg">No objects on layer.</div>
                        );
                    }
                } else if (activeTool === 'image') {
                    items.push(
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 mt-4" key="image-hint">
                            <ImageIcon className="w-12 h-12 text-slate-600 opacity-60" />
                            <div>
                                <p className="text-slate-300 font-medium mb-1 text-sm">Add Image</p>
                                <p className="text-xs text-slate-500 leading-relaxed">Click anywhere on the canvas to upload and place an image file.</p>
                            </div>
                        </div>
                    );
                }

                if (activeTool === 'shape') {
                    items.push(
                        <AccordionItem title="Shape Type" defaultOpen={true} key="shape-tool-props">
                            <ShapeControls
                                display="tools"
                                activeTool={activeTool}
                                onToolChange={handleToolChange}
                                selectedObjects={selectedObjects}
                                onUpdateSelectedObjects={handleUpdateSelectedObjects}
                                onDeleteSelectedObjects={handleDeleteSelectedObjects}
                                onCopySelectedObject={handleCopySelectedObject}
                                onPasteObject={handlePasteObject}
                                clipboardObject={clipboardObject}
                                onReorderObject={handleReorderObject}
                                onAlignObjects={handleAlignObjects}
                                onAlignToCanvas={handleAlignToCanvas}
                                onFlip={handleFlipObject}
                                activeLayer={activeLayer}
                                activeShapeType={activeShapeType}
                                onActiveShapeTypeChange={setActiveShapeType}
                                onSelectAll={handleSelectAll}
                                uniqueFills={uniqueFills}
                                onSelectObjectsByFill={handleSelectObjectsByFill}
                                activeLayerHasObjects={activeLayerHasObjects}
                                onUpdateActiveLayerSettings={handleUpdateActiveLayerSettings}
                                onDensityImageChange={handleDensityImageChange}
                                onApplyPatternFill={handleApplyPatternFill}
                                layers={layers}
                                onUpdateActiveLayer={handleUpdateActiveLayer}
                                canApplyPattern={false}
                                onGroup={handleGroup}
                                onUngroup={handleUngroup}
                                canGroup={canGroup}
                                canUngroup={canUngroup}
                                dpi={dpi}
                                units={units}
                                onInitiateTrace={projectManager.handleInitiateTrace}
                            />
                        </AccordionItem>
                    );
                }

                if (isBrushActive) {
                    items.push(
                        <AccordionItem title='Brush Options' defaultOpen={true} key="brush-tool-props">
                            <PatternBrushControls
                                activeLayer={activeLayer}
                                onUpdateActiveLayerSettings={handleUpdateActiveLayerSettings}
                                onUpdateActiveLayer={handleUpdateActiveLayer}
                            />
                        </AccordionItem>
                    );
                }

                if (isDrawingTool && activeTool !== 'measure') {
                    items.push(
                        <AccordionItem title="Drawing Properties" defaultOpen={true} key="drawing-props">
                            <ToolPropertiesControls
                                settings={toolSettings}
                                onUpdate={handleUpdateToolSettings}
                                activeTool={activeTool}
                            />
                        </AccordionItem>
                    );
                }
                
                if (isDrawingTool || isBrushActive) {
                    items.push(
                        <AccordionItem title="Symmetry" defaultOpen={true} key="symmetry-props">
                            <SymmetryControls 
                                mirrorMode={mirrorMode}
                                onMirrorModeChange={setMirrorMode}
                                mirrorGap={mirrorGap}
                                onMirrorGapChange={setMirrorGap}
                            />
                        </AccordionItem>
                    );
                }
            }
        }

        return items;
    };

    return (
        <aside ref={sidebarRef} style={{ width: `${width}px` }} className="relative bg-slate-950 p-0 flex-shrink-0 flex flex-col border-l border-slate-800 z-10 shadow-xl">
            <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 h-full w-1 cursor-ew-resize group z-20 hover:bg-cyan-500/50 transition-colors"></div>
            
            {/* Editing Mode Tab Switcher */}
            <div className="px-3 pt-3 pb-2 bg-slate-900 border-b border-slate-800">
                <div className="flex bg-slate-800 p-1 rounded-lg gap-1 border border-slate-700">
                    <button 
                        onClick={() => setEditingMode('shape')} 
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all duration-200 text-[11px] font-semibold uppercase tracking-wide space-x-1.5 ${editingMode === 'shape' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                        title="Edit Objects"
                    >
                        <SelectIcon className="w-3.5 h-3.5" />
                        <span>Object</span>
                    </button>
                    <button 
                        onClick={() => setEditingMode('layer')} 
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all duration-200 text-[11px] font-semibold uppercase tracking-wide space-x-1.5 ${editingMode === 'layer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                        title="Edit Layer Transform"
                    >
                        <LayersIcon className="w-3.5 h-3.5" />
                        <span>Layer</span>
                    </button>
                    <button 
                        onClick={() => setEditingMode('clip')} 
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all duration-200 text-[11px] font-semibold uppercase tracking-wide space-x-1.5 ${editingMode === 'clip' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                        title="Edit Clip Path"
                    >
                        <ClipIcon className="w-3.5 h-3.5" />
                        <span>Clip</span>
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto px-3 py-2 custom-scrollbar">
                <Accordion key={`${editingMode}-${selectedObjects.map(o => o.id).join('-')}`}>
                    {renderPropertiesContent()}
                </Accordion>
            </div>
        </aside>
    );
};

export default RightSidebar;