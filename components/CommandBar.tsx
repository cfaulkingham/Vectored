
import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '../context/EditorContext';
import { 
    SelectIcon, NodeToolIcon, ShapeIcon, LineIcon, DrawIcon, TextIcon, 
    FreehandIcon, PatternBrushIcon, ImageIcon, MeasureIcon,
    ExportIcon, ImportIcon, SaveIcon, NewFileIcon, SettingsIcon,
    SnapIcon, LayoutIcon, NestIcon
} from './controls/Icons';

/**
 * A Command Palette component (triggered by Ctrl/Cmd + K).
 * Allows rapid navigation and access to tools/actions via text search.
 */
export const CommandBar: React.FC = () => {
    const { 
        setActiveTool, setEditingMode, setViewState, projectManager, 
        snapSettings, setSnapSettings, handleApplyPathGroup,
        activeLayerHasObjects
    } = useEditor();

    const { 
        handleNewProject, handleSaveProjectFile, 
        setIsExportModalOpen, setIsCanvasSettingsModalOpen, setIsNestingModalOpen
    } = projectManager;

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const actions = [
        // Tools
        { id: 'tool-select', label: 'Select Tool', subtitle: 'Shortcut: V', icon: <SelectIcon className="w-4 h-4" />, action: () => setActiveTool('select') },
        { id: 'tool-node', label: 'Node Tool', subtitle: 'Shortcut: A', icon: <NodeToolIcon className="w-4 h-4" />, action: () => setActiveTool('node') },
        { id: 'tool-shape', label: 'Shape Tool', subtitle: 'Shortcut: R', icon: <ShapeIcon className="w-4 h-4" />, action: () => setActiveTool('shape') },
        { id: 'tool-pen', label: 'Pen Tool', subtitle: 'Shortcut: P', icon: <DrawIcon className="w-4 h-4" />, action: () => setActiveTool('polygon') },
        { id: 'tool-line', label: 'Line Tool', subtitle: 'Shortcut: L', icon: <LineIcon className="w-4 h-4" />, action: () => setActiveTool('line') },
        { id: 'tool-text', label: 'Text Tool', subtitle: 'Shortcut: T', icon: <TextIcon className="w-4 h-4" />, action: () => setActiveTool('text') },
        { id: 'tool-brush', label: 'Pattern Brush', subtitle: 'Shortcut: Shift+B', icon: <PatternBrushIcon className="w-4 h-4" />, action: () => setActiveTool('pattern-brush') },
        { id: 'tool-image', label: 'Image Tool', subtitle: 'Shortcut: I', icon: <ImageIcon className="w-4 h-4" />, action: () => setActiveTool('image') },
        { id: 'tool-measure', label: 'Measure Tool', subtitle: 'Shortcut: M', icon: <MeasureIcon className="w-4 h-4" />, action: () => setActiveTool('measure') },
        
        // Navigation / Modes
        { id: 'mode-shape', label: 'Object Editing Mode', subtitle: 'Switch to object transform mode', icon: <SelectIcon className="w-4 h-4" />, action: () => setEditingMode('shape') },
        { id: 'mode-layer', label: 'Layer Editing Mode', subtitle: 'Switch to layer transform mode', icon: <LayoutIcon className="w-4 h-4" />, action: () => setEditingMode('layer') },
        
        // Project Actions
        { id: 'project-new', label: 'New Project', subtitle: 'Clear canvas and start fresh', icon: <NewFileIcon />, action: handleNewProject },
        { id: 'project-save', label: 'Save Project', subtitle: 'Save as .vectored file', icon: <SaveIcon />, action: handleSaveProjectFile },
        { id: 'project-export', label: 'Export...', subtitle: 'Export to SVG, DXF, or PDF', icon: <ExportIcon />, action: () => setIsExportModalOpen(true) },
        { id: 'project-nest', label: 'Auto-Nest Objects', subtitle: 'Arrange parts for production', icon: <NestIcon />, action: () => setIsNestingModalOpen(true), disabled: !activeLayerHasObjects },
        
        // Settings
        { id: 'setting-snap-grid', label: 'Toggle Snap to Grid', subtitle: `Currently: ${snapSettings.grid ? 'On' : 'Off'}`, icon: <SnapIcon />, action: () => setSnapSettings(s => ({ ...s, grid: !s.grid })) },
        { id: 'setting-snap-smart', label: 'Toggle Smart Guides', subtitle: `Currently: ${snapSettings.smart ? 'On' : 'Off'}`, icon: <SnapIcon />, action: () => setSnapSettings(s => ({ ...s, smart: !s.smart })) },
        { id: 'setting-canvas', label: 'Canvas Settings', subtitle: 'Change units, size, or DPI', icon: <SettingsIcon />, action: () => setIsCanvasSettingsModalOpen(true) },
    ];

    const filteredActions = actions.filter(a => 
        a.label.toLowerCase().includes(query.toLowerCase()) || 
        a.subtitle?.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    const handleAction = (action: typeof actions[0]) => {
        if (action.disabled) return;
        action.action();
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredActions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredActions[selectedIndex]) {
                handleAction(filteredActions[selectedIndex]);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-[2px]">
            <div 
                className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/50">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500 mr-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input 
                        ref={inputRef}
                        type="text" 
                        className="bg-transparent border-none outline-none text-slate-200 text-base flex-grow placeholder:text-slate-600 font-sans"
                        placeholder="Search tools and commands..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono">ESC</kbd>
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto py-2 custom-scrollbar">
                    {filteredActions.length > 0 ? (
                        filteredActions.map((action, index) => (
                            <button
                                key={action.id}
                                className={`w-full flex items-center px-4 py-3 gap-3 transition-colors text-left ${
                                    index === selectedIndex ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'
                                } ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                onMouseMove={() => setSelectedIndex(index)}
                                onClick={() => handleAction(action)}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                                    index === selectedIndex ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                    {action.icon}
                                </div>
                                <div className="flex-grow">
                                    <div className={`text-sm font-medium ${index === selectedIndex ? 'text-cyan-100' : 'text-slate-200'}`}>
                                        {action.label}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                        {action.subtitle}
                                    </div>
                                </div>
                                {index === selectedIndex && (
                                    <span className="text-[10px] font-mono text-cyan-500/50">RETURN</span>
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-8 text-center text-slate-600 italic text-sm">
                            No commands found for "{query}"
                        </div>
                    )}
                </div>

                <div className="bg-slate-950/80 px-4 py-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex gap-4">
                         <div className="flex items-center gap-1.5">
                            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 font-mono">↑↓</kbd>
                            <span className="text-[10px] text-slate-600 uppercase tracking-tight">Navigate</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 font-mono">ENTER</kbd>
                            <span className="text-[10px] text-slate-600 uppercase tracking-tight">Select</span>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
