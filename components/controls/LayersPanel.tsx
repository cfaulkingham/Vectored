import React, { useState } from 'react';
import type { Layer, BlendMode, VectorObject } from '../../types';
import { 
    EyeIcon, EyeOffIcon, LockIcon, UnlockIcon, 
    PlusIcon, DuplicateIcon, TrashIcon, DownIcon, UpIcon
} from './Icons';
import { ChevronDown, ChevronRight, Shapes, Image as ImageIcon, Type } from 'lucide-react';

// Helper to get an icon for object type
const getObjectIcon = (type: string) => {
    switch (type) {
        case 'text': return <Type className="w-3 h-3" />;
        case 'image': return <ImageIcon className="w-3 h-3" />;
        default: return <Shapes className="w-3 h-3" />;
    }
};

interface LayersPanelProps {
    layers: Layer[];
    activeLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onAddLayer: () => void;
    onDuplicateLayer: () => void;
    onDeleteLayer: (id: string) => void;
    onToggleVisibility: (id: string) => void;
    onRenameLayer: (id: string, newName: string) => void;
    onLayerColorChange: (id: string, color: string) => void;
    onLayerBlendModeChange: (id: string, blendMode: BlendMode) => void;
    onMoveLayer: (direction: 'up' | 'down') => void;
    onToggleLockLayer: (id: string) => void;
    editingMode: 'shape' | 'clip' | 'layer';
    onSetLayers?: (layers: Layer[]) => void;
    onUpdateObjectProperty?: (layerId: string, objectId: string, property: string, value: any) => void;
    selectedObjects?: VectorObject[];
    setSelectedObjects?: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
}

const LayersPanel: React.FC<LayersPanelProps> = (props) => {
    const { 
        layers, activeLayerId, onSelectLayer, onAddLayer, onDuplicateLayer, onDeleteLayer, 
        onToggleVisibility, onRenameLayer, onLayerColorChange, onLayerBlendModeChange, 
        onMoveLayer, onToggleLockLayer, editingMode, onSetLayers, onUpdateObjectProperty,
        selectedObjects, setSelectedObjects
    } = props;
    
    // State for UI
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
    
    // State for Drag and Drop
    const [draggedItem, setDraggedItem] = useState<{type: 'layer' | 'object', id: string, layerId?: string} | null>(null);
    const [dragOverItem, setDragOverItem] = useState<{type: 'layer' | 'object', id: string, layerId?: string, position: 'before'|'after'|'inside'} | null>(null);
    
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);

    const toggleExpand = (layerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedLayers(prev => ({...prev, [layerId]: !prev[layerId]}));
    };

    const handleStartElementEditing = (id: string, name: string) => {
        setEditingId(id);
        setEditingName(name || '');
    };

    const handleFinishEditing = (type: 'layer'|'object', layerId: string, objectId?: string) => {
        if (editingId && editingName.trim()) {
            if (type === 'layer') {
                onRenameLayer(layerId, editingName.trim());
            } else if (type === 'object' && objectId && onUpdateObjectProperty) {
                onUpdateObjectProperty(layerId, objectId, 'name', editingName.trim());
            }
        }
        setEditingId(null);
        setEditingName('');
    };

    const handleSelectObject = (layerId: string, objectId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectLayer(layerId);
        if (setSelectedObjects) {
            setSelectedObjects({ layerId, objectIds: [objectId] });
        }
    };
    
    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, type: 'layer' | 'object', id: string, layerId?: string) => {
        e.stopPropagation();
        setDraggedItem({ type, id, layerId });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id); // Required for Firefox
    };

    const handleDragOver = (e: React.DragEvent, type: 'layer' | 'object', id: string, layerId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedItem || draggedItem.id === id) return;
        
        // Calculate whether to drop before or after based on mouse position relative to element
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const position = y < rect.height / 2 ? 'before' : 'after';

        setDragOverItem({ type, id, layerId, position });
    };

    const handleDragLeave = () => {
        setDragOverItem(null);
    };

    const handleDrop = (e: React.DragEvent, type: 'layer' | 'object', targetId: string, targetLayerId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedItem || !onSetLayers || draggedItem.id === targetId) {
            setDraggedItem(null);
            setDragOverItem(null);
            return;
        }

        const newLayers = [...layers.map(l => ({...l, objects: [...l.objects]}))];
        const position = dragOverItem?.position || 'before';

        try {
            if (draggedItem.type === 'layer' && type === 'layer') {
                // Reorder layers
                const sourceIdx = newLayers.findIndex(l => l.id === draggedItem.id);
                const targetIdx = newLayers.findIndex(l => l.id === targetId);
                
                if (sourceIdx !== -1 && targetIdx !== -1) {
                    const [moved] = newLayers.splice(sourceIdx, 1);
                    // Visual order is reversed array order. 
                    // To insert visually "before" means higher z-index (insert later in array)
                    const insertIdx = position === 'before' ? targetIdx + 1 : targetIdx;
                    newLayers.splice(insertIdx > sourceIdx ? insertIdx - 1 : insertIdx, 0, moved);
                }
            } 
            else if (draggedItem.type === 'object') {
                // Moving an object
                const sourceLayerIdx = newLayers.findIndex(l => l.id === draggedItem.layerId);
                if (sourceLayerIdx === -1) throw new Error("Source layer not found");
                
                const sourceObjects = newLayers[sourceLayerIdx].objects;
                const sourceObjIdx = sourceObjects.findIndex(o => o.id === draggedItem.id);
                if (sourceObjIdx === -1) throw new Error("Source object not found");
                
                const [movedObj] = sourceObjects.splice(sourceObjIdx, 1);

                if (type === 'layer') {
                    // Dropped onto a layer header - move to top of that layer
                    const targetLayerIdx = newLayers.findIndex(l => l.id === targetId);
                    if (targetLayerIdx !== -1) {
                        newLayers[targetLayerIdx].objects.push(movedObj);
                    }
                } else if (type === 'object' && targetLayerId) {
                    // Dropped onto another object
                    const targetLayerIdx = newLayers.findIndex(l => l.id === targetLayerId);
                    if (targetLayerIdx !== -1) {
                        const targetObjects = newLayers[targetLayerIdx].objects;
                        const targetObjIdx = targetObjects.findIndex(o => o.id === targetId);
                        
                        if (targetObjIdx !== -1) {
                            const insertIdx = position === 'before' ? targetObjIdx + 1 : targetObjIdx;
                            targetObjects.splice(insertIdx, 0, movedObj);
                        }
                    }
                }
            }
            onSetLayers(newLayers);
        } catch(err) {
            console.error("Drag and drop error", err);
        }

        setDraggedItem(null);
        setDragOverItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };

    const blendModes: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

    const getIndicatorStyle = (type: 'layer'|'object', id: string) => {
        if (!dragOverItem || dragOverItem.id !== id || dragOverItem.type !== type) return '';
        return dragOverItem.position === 'before' ? 'border-t-2 border-t-cyan-400' : 'border-b-2 border-b-cyan-400';
    };

    return (
        <div className="space-y-3">
            <div className="bg-gray-900/50 rounded-lg border border-gray-700 max-h-64 overflow-y-auto custom-scrollbar">
                {/* Visual Order: Reverse array so highest z-index is at top */}
                {[...layers].reverse().map(layer => {
                    const isExpanded = expandedLayers[layer.id];
                    const isLayerActive = activeLayerId === layer.id;
                    const layerBg = (isLayerActive && editingMode === 'layer') ? 'bg-indigo-900/40' : (isLayerActive && editingMode === 'shape') ? 'bg-cyan-900/30' : 'hover:bg-gray-700/30';
                    
                    return (
                        <div key={layer.id} className={`border-b border-gray-700 last:border-b-0 ${getIndicatorStyle('layer', layer.id)}`}>
                            {/* LAYER HEADER */}
                            <div 
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'layer', layer.id)}
                                onDragOver={(e) => handleDragOver(e, 'layer', layer.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'layer', layer.id)}
                                onDragEnd={handleDragEnd}
                                onClick={() => onSelectLayer(layer.id)}
                                onDoubleClick={() => handleStartElementEditing(layer.id, layer.name)}
                                className={`p-2 flex items-center cursor-pointer transition-colors ${layerBg}`}
                            >
                                <button onClick={(e) => toggleExpand(layer.id, e)} className="mr-1 text-gray-400 hover:text-white w-4 h-4 flex items-center justify-center transition-colors">
                                    {layer.objects.length > 0 ? (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
                                </button>
                                
                                <div
                                    className="w-4 h-4 rounded border border-gray-500 mr-2 flex-shrink-0 relative overflow-hidden"
                                    style={{ backgroundColor: layer.color }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="color"
                                        value={layer.color}
                                        onChange={(e) => { e.stopPropagation(); onLayerColorChange(layer.id, e.target.value); }}
                                        className="absolute inset-[-10px] w-8 h-8 opacity-0 cursor-pointer"
                                        title="Change layer color"
                                    />
                                </div>
                                
                                <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }} className="mr-2 text-gray-400 hover:text-white transition-colors" title={layer.visible ? "Hide layer" : "Show layer"}>
                                    {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                                </button>
                                
                                {editingId === layer.id ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => handleFinishEditing('layer', layer.id)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleFinishEditing('layer', layer.id)}
                                        className="bg-gray-600 text-white rounded px-1 text-sm flex-grow w-24 h-5 outline-none focus:ring-1 focus:ring-cyan-500"
                                        autoFocus
                                    />
                                ) : (
                                    <span className={`flex-grow text-sm truncate ${layer.isLocked ? 'text-gray-500' : 'text-gray-200'}`}>{layer.name}</span>
                                )}
                                
                                <div className="flex items-center ml-auto pl-2 gap-1 relative group hover:z-10">
                                    <select
                                        value={layer.blendMode}
                                        onChange={(e) => { e.stopPropagation(); onLayerBlendModeChange(layer.id, e.target.value as BlendMode); }}
                                        className="w-[14px] text-[0px] bg-transparent hover:bg-gray-700 rounded text-transparent mr-1 cursor-pointer outline-none focus:ring-0 appearance-none"
                                        title={`Blend Mode: ${layer.blendMode}`}
                                        disabled={layer.isLocked}
                                    >
                                        <option value="normal">Normal</option>
                                        {blendModes.map(mode => <option key={mode} value={mode} className="text-sm text-black">{mode.replace('-', ' ')}</option>)}
                                    </select>
                                    <div className="w-2 h-2 rounded-full absolute ml-1 pointer-events-none mix-blend-difference" style={{background: layer.blendMode !== 'normal' ? 'white' : 'transparent'}}></div>
                                    
                                    <button onClick={(e) => { e.stopPropagation(); onToggleLockLayer(layer.id); }} title={layer.isLocked ? "Unlock Layer" : "Lock Layer"} className={`p-1 rounded transition-colors ${layer.isLocked ? 'text-cyan-400' : 'text-gray-500 hover:bg-gray-600 hover:text-white'}`}>
                                        {layer.isLocked ? <LockIcon /> : <UnlockIcon />}
                                    </button>
                                </div>
                            </div>
                            
                            {/* OBJECTS NESTED LIST */}
                            {isExpanded && (
                                <div className="bg-gray-950/40">
                                    {[...layer.objects].reverse().map(obj => {
                                        const isSelected = selectedObjects?.some(o => o.id === obj.id);
                                        const objVisible = obj.visible ?? true;
                                        const objLocked = obj.isLocked ?? false;
                                        
                                        return (
                                            <div 
                                                key={obj.id} 
                                                draggable={!layer.isLocked}
                                                onDragStart={(e) => handleDragStart(e, 'object', obj.id, layer.id)}
                                                onDragOver={(e) => handleDragOver(e, 'object', obj.id, layer.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, 'object', obj.id, layer.id)}
                                                onDragEnd={handleDragEnd}
                                                onClick={(e) => handleSelectObject(layer.id, obj.id, e)}
                                                onDoubleClick={() => handleStartElementEditing(obj.id, obj.name || obj.type)}
                                                className={`pl-8 pr-2 py-1 flex items-center cursor-pointer transition-colors border-l-[3px] border-y border-y-transparent ${getIndicatorStyle('object', obj.id)} ${isSelected ? 'bg-cyan-900/20 border-l-cyan-500' : 'border-l-gray-800 hover:bg-gray-800/40'}`}
                                            >
                                                <div className="mr-2 text-gray-500 opacity-60">
                                                    {getObjectIcon(obj.type)}
                                                </div>
                                                
                                                <button onClick={(e) => { e.stopPropagation(); onUpdateObjectProperty && onUpdateObjectProperty(layer.id, obj.id, 'visible', !objVisible); }} className="mr-2 text-gray-500 hover:text-white transition-colors" title={objVisible ? "Hide object" : "Show object"}>
                                                    {objVisible ? <EyeIcon /> : <EyeOffIcon className="opacity-50" />}
                                                </button>
                                                
                                                {editingId === obj.id ? (
                                                    <input
                                                        type="text"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onBlur={() => handleFinishEditing('object', layer.id, obj.id)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleFinishEditing('object', layer.id, obj.id)}
                                                        className="bg-gray-700 text-white rounded px-1 flex-grow text-xs h-5 outline-none focus:ring-1 focus:ring-cyan-500"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className={`text-[11px] flex-grow truncate ${objLocked || !objVisible ? 'text-gray-500' : 'text-gray-300'}`}>{obj.name || obj.type.charAt(0).toUpperCase() + obj.type.slice(1)}</span>
                                                )}
                                                
                                                <button onClick={(e) => { e.stopPropagation(); onUpdateObjectProperty && onUpdateObjectProperty(layer.id, obj.id, 'isLocked', !objLocked); }} className={`p-1 rounded transition-colors ${objLocked ? 'text-cyan-400' : 'text-gray-600 hover:text-white'} opacity-80 hover:opacity-100`}>
                                                    {objLocked ? <LockIcon /> : <UnlockIcon />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="grid grid-cols-5 gap-2 text-gray-400">
                <button onClick={onAddLayer} title="Add Layer" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-cyan-600 hover:text-white transition"><PlusIcon /></button>
                <button onClick={onDuplicateLayer} title="Duplicate Layer" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-cyan-600 hover:text-white transition"><DuplicateIcon /></button>
                {/* Note: DownIcon moves the layer DOWN in the UI (which means visually UP) so we swap disabled checks */}
                <button onClick={() => onMoveLayer('down')} disabled={activeIndex === layers.length - 1} title="Move Layer Back" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-cyan-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"><DownIcon /></button>
                <button onClick={() => onMoveLayer('up')} disabled={activeIndex === 0} title="Move Layer Forward" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-cyan-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"><UpIcon /></button>
                <button disabled={!activeLayerId || layers.length <= 1} onClick={() => activeLayerId && onDeleteLayer(activeLayerId)} title="Delete Layer" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-red-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"><TrashIcon /></button>
            </div>
        </div>
    );
};

export default LayersPanel;
