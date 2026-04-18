
import React, { useMemo } from 'react';
import { useEditor } from '../context/EditorContext';
import { 
    Trash2, Copy, Combine, Split, Layers, MoveUp, MoveDown, 
    FlipHorizontal, FlipVertical
} from 'lucide-react';
import {
    AlignLeftIcon, AlignCenterHIcon, AlignRightIcon, AlignTopIcon, AlignCenterVIcon, AlignBottomIcon
} from './controls/Icons';

/**
 * A floating action menu that appears near the selected objects.
 * Provides quick access to common manipulations like deletion, duplication, and alignment.
 */
export const CanvasQuickActions: React.FC = () => {
    const { 
        selectedObjects, selectionBounds, viewState, canvasConfig,
        handleDeleteSelectedObjects, handleCopySelectedObject, handlePasteObject,
        handleFlipObject, handleAlignObjects, handleReorderObject,
        canGroup, handleGroup, handleUngroup, canUngroup,
        handleBooleanOperation
    } = useEditor();

    // Only show if something is selected and we have bounds
    if (selectedObjects.length === 0 || !selectionBounds) return null;

    // Convert world bounds to screen coordinates
    const padding = 12;
    const top = (selectionBounds.y * viewState.zoom + viewState.y) - 48;
    const left = (selectionBounds.x * viewState.zoom + viewState.x) + (selectionBounds.width * viewState.zoom) / 2;

    // Constrain to viewport
    const boundedTop = Math.max(10, top);
    
    const handleDuplicate = () => {
        handleCopySelectedObject();
        handlePasteObject();
    };

    return (
        <div 
            className="fixed z-40 flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-xl animate-fade-in pointer-events-auto"
            style={{ 
                top: `${boundedTop}px`, 
                left: `${left}px`,
                transform: 'translateX(-50%)'
            }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex items-center px-1">
                 <button 
                    onClick={handleDeleteSelectedObjects}
                    className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-md transition-colors"
                    title="Delete (Backspace)"
                >
                    <Trash2 size={16} />
                </button>
                <button 
                    onClick={handleDuplicate}
                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                    title="Duplicate (Ctrl+D)"
                >
                    <Copy size={16} />
                </button>
            </div>

            <div className="w-px h-4 bg-slate-800 mx-1"></div>

            <div className="flex items-center px-1">
                <button 
                    onClick={() => handleFlipObject('horizontal')}
                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                    title="Flip Horizontal"
                >
                    <FlipHorizontal size={16} />
                </button>
                <button 
                    onClick={() => handleFlipObject('vertical')}
                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                    title="Flip Vertical"
                >
                    <FlipVertical size={16} />
                </button>
            </div>

            {selectedObjects.length > 2 && (
                <>
                    <div className="w-px h-4 bg-slate-800 mx-1"></div>
                    <div className="flex items-center px-1">
                        <button 
                            onClick={handleGroup}
                            className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                            title="Group (Ctrl+G)"
                        >
                            <Combine size={16} />
                        </button>
                    </div>
                </>
            )}

            {canUngroup && (
                <>
                     <div className="w-px h-4 bg-slate-800 mx-1"></div>
                     <div className="flex items-center px-1">
                        <button 
                            onClick={handleUngroup}
                            className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                            title="Ungroup (Ctrl+Shift+G)"
                        >
                            <Split size={16} />
                        </button>
                    </div>
                </>
            )}

            {selectedObjects.length === 2 && (
                <>
                    <div className="w-px h-4 bg-slate-800 mx-1"></div>
                    <div className="flex items-center px-1">
                        <button 
                            onClick={() => handleBooleanOperation('unite')}
                            className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                            title="Unite"
                        >
                            <Layers size={16} />
                        </button>
                    </div>
                </>
            )}

             <div className="w-px h-4 bg-slate-800 mx-1"></div>
             <div className="flex items-center px-1">
                <button 
                    onClick={() => handleReorderObject('forward')}
                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                    title="Bring Forward"
                >
                    <MoveUp size={16} />
                </button>
                <button 
                    onClick={() => handleReorderObject('backward')}
                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-md transition-colors"
                    title="Send Backward"
                >
                    <MoveDown size={16} />
                </button>
            </div>
        </div>
    );
};
