
import React, { useState, useCallback, useRef } from 'react';
import type { InteractionState, Units, VectorObjectType, ShapeType, MirrorMode, VectorObject, TextObject, SnapSettings, ActiveGuide } from '../types';

/**
 * Custom hook to manage transient editor state.
 * This includes UI state like active tools, selection info, zoom/pan settings, 
 * mirror settings, and clipboard content, which generally don't need to be 
 * part of the undo/redo history stack.
 *
 * @returns An object containing state variables and their setters for the editor UI.
 */
export const useEditorState = () => {
  const [interaction, setInteraction] = useState<InteractionState>({ mode: 'idle' });
  const [densityImages, setDensityImages] = useState<Record<string, HTMLImageElement>>({});
  const [editingMode, setEditingMode] = useState<'shape' | 'clip' | 'layer'>('shape');
  const [units, setUnits] = useState<Units>('mm');
  const [activeTool, setActiveTool] = useState<'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure'>('select');
  const [selectedObjectInfo, setSelectedObjectInfo] = useState<{ layerId: string; objectIds: string[] } | null>(null);
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rectangle');
  const [clipboardObject, setClipboardObject] = useState<VectorObject | null>(null);
  const [viewState, setViewState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('off');
  const [mirrorGap, setMirrorGap] = useState(0);
  const [toolSettings, setToolSettings] = useState<Partial<VectorObject & TextObject>>({
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      cornerRadius: 0,
      opacity: 1,
      fillOpacity: 1,
      strokeOpacity: 1,
      blendMode: 'normal',
      fontSize: 48,
      fontFamily: 'Roboto',
      fontWeight: 'normal',
  });
  
  // Snapping State
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
      grid: false,
      gridSize: 10,
      smart: true,
      threshold: 5
  });
  const [activeGuides, setActiveGuides] = useState<ActiveGuide[]>([]);

  const handleUpdateToolSettings = useCallback((props: Partial<VectorObject>) => {
      setToolSettings(prev => ({ ...prev, ...props } as Partial<VectorObject & TextObject>));
  }, []);


  /**
   * Updates the active tool and clears selection if switching to a creation tool (except flow-guide).
   * Sets default styles based on the selected tool type to ensure good UX (e.g., text is black, shapes are white w/ border).
   * 
   * @param tool - The new tool to activate.
   */
  const handleToolChange = useCallback((tool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure') => {
    setActiveTool(tool);
    if (tool !== 'select' && tool !== 'node' && tool !== 'flow-guide' && tool !== 'measure') {
        setSelectedObjectInfo(null);
    }

    // Set default properties for specific tools
    if (tool === 'text') {
        setToolSettings(prev => ({
            ...prev,
            fill: '#000000',
            stroke: 'none',
            strokeWidth: 0
        }));
    } else if (['shape', 'polygon'].includes(tool)) {
        setToolSettings(prev => ({
            ...prev,
            fill: '#ffffff',
            stroke: '#000000',
            strokeWidth: 1,
            cornerRadius: 0
        }));
    } else if (['line', 'path'].includes(tool)) {
        setToolSettings(prev => ({
            ...prev,
            fill: 'none',
            stroke: '#000000',
            strokeWidth: 1
        }));
    }
  }, []); 

  return {
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
  };
};
