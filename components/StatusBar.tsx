
import React from 'react';
import { useEditor } from '../context/EditorContext';
import { SelectIcon, ShapeIcon, LayersIcon } from './controls/Icons';

/**
 * A status bar component that sits at the bottom of the editor.
 * Displays contextual information like mouse coordinates, selection info, zoom level, and hints.
 */
export const StatusBar: React.FC = () => {
    const { 
        cursorPos, selectedObjects, activeTool, viewState, units, dpi, 
        activeLayer, activeLayerId,
        editingMode
    } = useEditor();

    // Format coordinates based on units
    const formatCoord = (px: number) => {
        if (units === 'mm') return (px * 25.4 / dpi).toFixed(1);
        if (units === 'in') return (px / dpi).toFixed(2);
        return Math.round(px).toString();
    };

    const selectionText = selectedObjects.length > 0 
        ? `${selectedObjects.length} object${selectedObjects.length > 1 ? 's' : ''} selected`
        : 'No selection';

    const toolHints: Record<string, string> = {
        'select': 'V: Move, Resize, Rotate. Hold Shift to constrain.',
        'node': 'A: Double click to edit path nodes.',
        'shape': 'R: Click and drag to create shapes.',
        'polygon': 'P: Click to add vertices. Double click or click start to close.',
        'line': 'L: Drag to draw straight lines.',
        'text': 'T: Click to add text.',
        'path': 'B: Freehand drawing.',
        'pattern-brush': 'Shift+B: Draw paths with pattern repetitions.',
        'measure': 'M: Measure distances between points or object dimensions.',
        'image': 'I: Click to import an image.'
    };

    return (
        <div className="h-7 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-3 text-[10px] text-slate-500 font-mono select-none">
            {/* Left: Tool Hint & Selection */}
            <div className="flex items-center gap-4 overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-[140px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Tool:</span>
                    <span className="text-slate-300 truncate max-w-[200px]">{toolHints[activeTool] || activeTool}</span>
                </div>
                
                <div className="h-3 w-px bg-slate-800"></div>
                
                <div className="flex items-center gap-1.5">
                    <SelectIcon className="w-3 h-3 text-cyan-500/50" />
                    <span className="text-slate-300">{selectionText}</span>
                </div>

                {activeLayer && (
                     <>
                        <div className="h-3 w-px bg-slate-800"></div>
                        <div className="flex items-center gap-1.5">
                            <LayersIcon className="w-3 h-3 text-indigo-500/50" />
                            <span className="text-slate-300">Layer: {activeLayer.name}</span>
                        </div>
                     </>
                )}
            </div>

            {/* Right: Coordinates & Zoom */}
            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                         <span className="text-slate-600">X:</span>
                         <span className="text-slate-300 min-w-[3rem] text-right">{cursorPos ? formatCoord(cursorPos[0]) : '0'}{units}</span>
                    </div>
                    <div className="flex gap-1.5">
                         <span className="text-slate-600">Y:</span>
                         <span className="text-slate-300 min-w-[3rem] text-right">{cursorPos ? formatCoord(cursorPos[1]) : '0'}{units}</span>
                    </div>
                </div>

                <div className="h-3 w-px bg-slate-800"></div>

                <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 uppercase">Zoom:</span>
                    <span className="text-cyan-400/80 font-bold">{Math.round(viewState.zoom * 100)}%</span>
                </div>
                
                <div className="h-3 w-px bg-slate-800"></div>

                <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 uppercase">Mode:</span>
                    <span className={`px-1.5 py-0.5 rounded ${
                        editingMode === 'shape' ? 'bg-cyan-500/10 text-cyan-400' :
                        editingMode === 'layer' ? 'bg-indigo-500/10 text-indigo-400' :
                        'bg-teal-500/10 text-teal-400'
                    }`}>
                        {editingMode}
                    </span>
                </div>
            </div>
        </div>
    );
};
