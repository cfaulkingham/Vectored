import React from 'react';
import { useEditor } from '../context/EditorContext';
import ControlButton from './controls/ControlButton';
import { SelectIcon, NodeToolIcon, TextIcon, FreehandIcon, LineIcon, ShapeIcon, PatternBrushIcon, ImageIcon, MeasureIcon, DrawIcon } from './controls/Icons';

/**
 * The vertical toolbar on the left side of the application.
 * Contains buttons for switching between different tools like Select, Shape, Line, Text, etc.
 * Provides tooltips with keyboard shortcuts for better discoverability.
 */
const VerticalToolbar: React.FC = () => {
    const { activeTool, handleToolChange } = useEditor();

    return (
        <aside className="w-14 bg-slate-900/95 p-2 flex-shrink-0 flex flex-col items-center space-y-3 border-r border-slate-800/50 z-10 pt-4">
            <ControlButton onClick={() => handleToolChange('select')} active={activeTool === 'select'} title="Select Tool (V)"><SelectIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('node')} active={activeTool === 'node'} title="Node Tool (A)"><NodeToolIcon className="w-5 h-5" /></ControlButton>
            <div className="w-8 h-px bg-slate-700/50 my-1"></div>
            <ControlButton onClick={() => handleToolChange('shape')} active={activeTool === 'shape'} title="Shape Tool (R)"><ShapeIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('line')} active={activeTool === 'line'} title="Line Tool (L)"><LineIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('polygon')} active={activeTool === 'polygon'} title="Pen Tool (P)"><DrawIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('text')} active={activeTool === 'text'} title="Text Tool (T)"><TextIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('path')} active={activeTool === 'path' || activeTool === 'flow-guide'} title="Freehand Tool (B)"><FreehandIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('pattern-brush')} active={activeTool === 'pattern-brush'} title="Pattern Brush (Shift+B)"><PatternBrushIcon className="w-5 h-5" /></ControlButton>
            <ControlButton onClick={() => handleToolChange('image')} active={activeTool === 'image'} title="Image Tool (I)"><ImageIcon className="w-5 h-5" /></ControlButton>
            <div className="w-8 h-px bg-slate-700/50 my-1"></div>
            <ControlButton onClick={() => handleToolChange('measure')} active={activeTool === 'measure'} title="Measure Tool (M)"><MeasureIcon className="w-5 h-5" /></ControlButton>
        </aside>
    );
};

export default VerticalToolbar;