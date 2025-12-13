import React, { useState } from 'react';
import type { Layer, BlendMode } from '../../types';
import { 
    EyeIcon, EyeOffIcon, LockIcon, UnlockIcon, 
    PlusIcon, DuplicateIcon, TrashIcon, DownIcon, UpIcon
} from './Icons';

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
}

/**
 * Panel for managing layers in the editor.
 * Displays a list of layers with controls for visibility, locking, color, blend mode, and reordering.
 * Allows creating, duplicating, renaming, and deleting layers.
 */
const LayersPanel: React.FC<LayersPanelProps> = (props) => {
    const { layers, activeLayerId, onSelectLayer, onAddLayer, onDuplicateLayer, onDeleteLayer, onToggleVisibility, onRenameLayer, onLayerColorChange, onLayerBlendModeChange, onMoveLayer, onToggleLockLayer, editingMode } = props;
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const activeIndex = layers.findIndex(l => l.id === activeLayerId);

    const handleStartEditing = (layer: Layer) => {
        setEditingId(layer.id);
        setEditingName(layer.name);
    };

    const handleFinishEditing = () => {
        if (editingId && editingName.trim()) {
            onRenameLayer(editingId, editingName.trim());
        }
        setEditingId(null);
        setEditingName('');
    };
    
    const blendModes: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

    return (
        <div className="space-y-3">
            <div className="bg-gray-900/50 rounded-lg border border-gray-700 max-h-48 overflow-y-auto">
                {layers.map(layer => (
                    <div key={layer.id}
                        onClick={() => onSelectLayer(layer.id)}
                        onDoubleClick={() => handleStartEditing(layer)}
                        className={`p-2 border-b border-gray-700 last:border-b-0 cursor-pointer transition-colors 
                        ${(activeLayerId === layer.id && editingMode === 'shape') ? 'bg-cyan-900/50' : ''} 
                        ${(activeLayerId === layer.id && editingMode === 'layer') ? 'bg-indigo-900/50' : ''} 
                        hover:bg-gray-700/50`}>
                        <div className="flex items-center">
                            <div
                                className="w-5 h-5 rounded border border-gray-500 mr-2 flex-shrink-0"
                                style={{ backgroundColor: layer.color }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <input
                                    type="color"
                                    value={layer.color}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onLayerColorChange(layer.id, e.target.value);
                                    }}
                                    className="w-full h-full opacity-0 cursor-pointer"
                                    title="Change layer color"
                                />
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }} className="mr-2 text-gray-400 hover:text-white">
                                {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            
                            {editingId === layer.id ? (
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={handleFinishEditing}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFinishEditing()}
                                    className="bg-gray-600 text-white rounded px-1 flex-grow"
                                    autoFocus
                                />
                            ) : (
                                <span className="flex-grow text-sm truncate">{layer.name}</span>
                            )}
                            
                            <div className="flex items-center ml-auto pl-2">
                                <select
                                    value={layer.blendMode}
                                    onChange={(e) => { e.stopPropagation(); onLayerBlendModeChange(layer.id, e.target.value as BlendMode); }}
                                    className="text-xs bg-gray-700 rounded p-1 text-gray-300 mr-2 capitalize focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Blend Mode"
                                    disabled={layer.isLocked}
                                >
                                    {blendModes.map(mode => <option key={mode} value={mode} className="capitalize">{mode.replace('-', ' ')}</option>)}
                                </select>
                                <button onClick={(e) => { e.stopPropagation(); onToggleLockLayer(layer.id); }} title={layer.isLocked ? "Unlock Layer" : "Lock Layer"} className={`p-1 rounded ${layer.isLocked ? 'text-cyan-400' : 'text-gray-500'} hover:bg-gray-600`}>
                                    {layer.isLocked ? <LockIcon /> : <UnlockIcon />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-5 gap-2 text-gray-400">
                <button onClick={onAddLayer} title="Add Layer" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-gray-600 hover:text-white transition"><PlusIcon /></button>
                <button onClick={onDuplicateLayer} title="Duplicate Layer" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-gray-600 hover:text-white transition"><DuplicateIcon /></button>
                <button onClick={() => onMoveLayer('down')} disabled={activeIndex === 0} title="Move Down" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-gray-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"><DownIcon /></button>
                <button onClick={() => onMoveLayer('up')} disabled={activeIndex === layers.length - 1} title="Move Up" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-gray-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"><UpIcon /></button>
                <button disabled={!activeLayerId || layers.length <= 1} onClick={() => activeLayerId && onDeleteLayer(activeLayerId)} title="Delete Layer" className="flex justify-center items-center p-2 bg-gray-700 rounded hover:bg-gray-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"><TrashIcon /></button>
            </div>
        </div>
    );
};

export default LayersPanel;
