import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { VectorObject, VectorObjectType, TextObject, Layer, PathObject, ShapeType, ShapeObject, Gradient, AlignmentType, LayerSettings, PathGroupObject, BlendMode, Units, ImageObject } from '../../types';
import { EyedropperIcon } from './Icons';
import { googleFonts, invertHexColor } from '../../lib/utils';
import { PatternControls } from './PatternControls';
import { GradientEditor } from './GradientEditor';
import { ControlSlider, SegmentedControl, ControlSelect, SectionHeader } from './CommonControls';
import { Accordion, AccordionItem } from './Accordion';

interface ShapeControlsProps {
    activeTool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure';
    onToolChange: (tool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure') => void;
    selectedObjects: VectorObject[];
    onUpdateSelectedObjects: (props: Partial<VectorObject>) => void;
    onDeleteSelectedObjects: () => void;
    onCopySelectedObject: () => void;
    onPasteObject: () => void;
    clipboardObject: VectorObject | null;
    onReorderObject: (direction: 'forward' | 'backward' | 'front' | 'back') => void;
    onAlignObjects: (alignment: AlignmentType) => void;
    onAlignToCanvas: (alignment: AlignmentType) => void;
    onFlip: (direction: 'horizontal' | 'vertical') => void;
    onInitiateTrace: (image: ImageObject) => void;
    activeLayer: Layer | undefined;
    activeShapeType: ShapeType;
    onActiveShapeTypeChange: (type: ShapeType) => void;
    display: 'tools' | 'properties';
    onSelectAll?: () => void;
    uniqueFills?: (string | Gradient)[];
    onSelectObjectsByFill?: (fill: string | Gradient) => void;
    activeLayerHasObjects?: boolean;
    onUpdateActiveLayerSettings?: (settings: Partial<LayerSettings>) => void;
    onDensityImageChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onApplyPatternFill?: () => void;
    layers?: Layer[];
    onUpdateActiveLayer?: (updater: (layer: Layer) => void) => void;
    canApplyPattern?: boolean;
    onGroup: () => void;
    onUngroup: () => void;
    canGroup: boolean;
    canUngroup: boolean;
    dpi: number;
    units: Units;
}

type DimensionUnit = 'px' | 'mm' | 'in';

const standardFonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];
const blendModes: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

/**
 * A comprehensive control panel for editing vector objects.
 * Handles properties like dimensions, position, rotation, skew, opacity, blend mode,
 * fill (solid, gradient, pattern), stroke, and typography for text objects.
 * Also switches between 'tool' mode (for initial settings) and 'properties' mode (for editing selection).
 */
export const ShapeControls: React.FC<ShapeControlsProps> = ({
    activeTool, onToolChange, selectedObjects, onUpdateSelectedObjects, onDeleteSelectedObjects, onCopySelectedObject, onPasteObject, clipboardObject, onReorderObject, onAlignObjects, onAlignToCanvas, onFlip, activeLayer, activeShapeType, onActiveShapeTypeChange, display, onSelectAll, uniqueFills, onSelectObjectsByFill, activeLayerHasObjects,
    onUpdateActiveLayerSettings, onDensityImageChange, onApplyPatternFill, layers, onUpdateActiveLayer, canApplyPattern,
    onGroup, onUngroup, canGroup, canUngroup, dpi, units, onInitiateTrace
}) => {
    
    const isSingleSelection = selectedObjects.length === 1;
    const selectedObject = isSingleSelection ? selectedObjects[0] : null;
    
    const [isSelectByColorOpen, setIsSelectByColorOpen] = useState(false);
    const selectByColorButtonRef = useRef<HTMLButtonElement>(null);
    const selectByColorPopoverRef = useRef<HTMLDivElement>(null);
    const [dimensionUnits, setDimensionUnits] = useState<DimensionUnit>(units);

    useEffect(() => {
        setDimensionUnits(units);
    }, [units]);

    const convertFromPx = useCallback((px: number, unit: DimensionUnit) => {
        if (unit === 'px') return px;
        if (unit === 'mm') return (px * 25.4) / dpi;
        return px / dpi;
    }, [dpi]);

    const convertToPx = useCallback((unitValue: number, unit: DimensionUnit) => {
        if (unit === 'px') return unitValue;
        if (unit === 'mm') return (unitValue * dpi) / 25.4;
        return unitValue * dpi;
    }, [dpi]);

    const getFillMode = (): 'none' | 'solid' | 'linear' | 'radial' | 'pattern' => {
        if (!isSingleSelection || !selectedObject) return 'none';
        if (selectedObject.type === 'image') return 'none';
        const fill = selectedObject.fill;
        if (fill === 'none') return 'none';
        if (typeof fill === 'string') return 'solid';
        if ('type' in fill && (fill.type === 'linear' || fill.type === 'radial')) {
            return fill.type;
        }
        return 'solid'; 
    };
    
    const [fillMode, setFillMode] = useState<'none' | 'solid' | 'linear' | 'radial' | 'pattern'>(getFillMode());

    useEffect(() => {
        if (fillMode !== 'pattern') {
            setFillMode(getFillMode());
        }
    }, [selectedObjects]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isSelectByColorOpen && selectByColorButtonRef.current && !selectByColorButtonRef.current.contains(event.target as Node) && selectByColorPopoverRef.current && !selectByColorPopoverRef.current.contains(event.target as Node)) {
                setIsSelectByColorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [isSelectByColorOpen]);

    const handleSelectByFill = (fill: string | Gradient) => {
        onSelectObjectsByFill?.(fill);
        setIsSelectByColorOpen(false);
    }

    const [localDims, setLocalDims] = useState({ x: '', y: '', width: '', height: '' });
    const [focusedDim, setFocusedDim] = useState<string | null>(null);

    useEffect(() => {
        if (focusedDim) return;
        if (isSingleSelection && selectedObject) {
            const precision = dimensionUnits === 'px' ? 1 : dimensionUnits === 'mm' ? 2 : 3;
            setLocalDims({
                x: convertFromPx(selectedObject.x ?? 0, dimensionUnits).toFixed(precision),
                y: convertFromPx(selectedObject.y ?? 0, dimensionUnits).toFixed(precision),
                width: convertFromPx(selectedObject.width ?? 0, dimensionUnits).toFixed(precision),
                height: convertFromPx(selectedObject.height ?? 0, dimensionUnits).toFixed(precision),
            });
        }
    }, [selectedObject, isSingleSelection, focusedDim, dimensionUnits, convertFromPx]);

    const handleDimChange = (field: 'x' | 'y' | 'width' | 'height') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const valueStr = e.target.value;
        setLocalDims(prev => ({ ...prev, [field]: valueStr }));
        const valueNum = parseFloat(valueStr);
        if (!isNaN(valueNum)) {
            const pxValue = convertToPx(valueNum, dimensionUnits);
            const update = { [field]: pxValue };
            if (field === 'width' || field === 'height') {
                update[field] = Math.max(1, pxValue);
            }
            onUpdateSelectedObjects(update);
        }
    };

    const handleSetFillType = (type: string) => {
        const fillType = type as 'none' | 'solid' | 'linear' | 'radial' | 'pattern';
        setFillMode(fillType);

        if (fillType === 'pattern') {
            onUpdateSelectedObjects({ fill: 'none' });
            return;
        }

        if (onUpdateActiveLayerSettings) {
            onUpdateActiveLayerSettings({ patternType: 'none' });
        }

        if (fillType === 'none') {
            onUpdateSelectedObjects({ fill: 'none' });
            return;
        }

        let newFill: string | Gradient;
        const currentFill = selectedObjects[0]?.fill;
        const currentColor = typeof currentFill === 'string' ? (currentFill === 'none' ? '#ffffff' : currentFill) : currentFill.stops[0].color;
        const endColor = typeof currentFill === 'string' ? invertHexColor(currentColor) : currentFill.stops[currentFill.stops.length-1].color;

        if (fillType === 'solid') {
            newFill = currentColor;
        } else if (fillType === 'linear') {
            newFill = { type: 'linear', angle: 90, stops: [{ offset: 0, color: currentColor }, { offset: 1, color: endColor }] };
        } else { // radial
            newFill = { type: 'radial', cx: 0.5, cy: 0.5, r: 0.5, stops: [{ offset: 0, color: currentColor }, { offset: 1, color: endColor }] };
        }
        onUpdateSelectedObjects({ fill: newFill });
    };

    if (display === 'tools') {
        return (
            <div className="w-full">
                {(activeTool === 'shape' || (selectedObject && selectedObject.type === 'shape')) && (
                    <div className="space-y-3">
                        <ControlSelect 
                            label="Shape Type"
                            value={selectedObject?.type === 'shape' ? (selectedObject as ShapeObject).shapeType : activeShapeType}
                            onChange={(val) => {
                                const newType = val as ShapeType;
                                if (selectedObject?.type === 'shape') {
                                    onUpdateSelectedObjects({ shapeType: newType } as Partial<ShapeObject>);
                                } else {
                                    onActiveShapeTypeChange(newType);
                                }
                            }}
                        >
                            <optgroup label="Basic Shapes">
                                <option value="rectangle">Rectangle</option>
                                <option value="ellipse">Ellipse</option>
                                <option value="triangle">Triangle</option>
                                <option value="diamond">Diamond</option>
                            </optgroup>
                            <optgroup label="Polygons">
                                <option value="pentagon">Pentagon</option>
                                <option value="hexagon">Hexagon</option>
                                <option value="octagon">Octagon</option>
                            </optgroup>
                            <optgroup label="Symbols">
                                <option value="star">Star</option>
                                <option value="cross">Cross</option>
                                <option value="arrow">Arrow</option>
                                <option value="heart">Heart</option>
                                <option value="moon">Moon</option>
                                <option value="ring">Ring</option>
                            </optgroup>
                        </ControlSelect>
                    </div>
                )}
            </div>
        );
    }

    if (display === 'properties') {
        if (selectedObjects.length === 0) {
            return (
                <div className="p-4 text-center text-gray-500 text-xs">
                    {activeLayerHasObjects ? "No object selected." : "No objects on this layer."}
                </div>
            );
        }

        const isImage = selectedObject?.type === 'image';
        const step = dimensionUnits === 'px' ? 1 : dimensionUnits === 'mm' ? 0.1 : 0.01;

        return (
             <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                     <span className="text-xs text-gray-400 capitalize">{selectedObjects.length} {selectedObjects.length > 1 ? 'items' : 'item'} selected</span>
                    <div className="relative">
                         <button ref={selectByColorButtonRef} onClick={() => setIsSelectByColorOpen(v => !v)} disabled={!activeLayerHasObjects} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50" title="Select by Fill">
                            <EyedropperIcon className="w-3.5 h-3.5" />
                        </button>
                        {isSelectByColorOpen && (
                            <div ref={selectByColorPopoverRef} className="absolute top-full mt-2 right-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 p-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Select by Fill</h3>
                                {uniqueFills && uniqueFills.length > 0 ? (
                                    <div className="max-h-64 overflow-y-auto grid grid-cols-6 gap-2">
                                        {uniqueFills.map((fill, i) => {
                                            const isGradient = typeof fill === 'object';
                                            let style: React.CSSProperties = {};
                                            if (isGradient) {
                                                if (fill.type === 'linear') { style.backgroundImage = `linear-gradient(${fill.angle}deg, ${fill.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`; } 
                                                else { style.backgroundImage = `radial-gradient(circle at ${fill.cx*100}% ${fill.cy*100}%, ${fill.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`; }
                                            } else { style.backgroundColor = String(fill); }
                                            return ( <button key={i} onClick={() => handleSelectByFill(fill)} className={`w-6 h-6 rounded-sm border border-gray-600 hover:border-cyan-400 transition-colors ${fill === 'none' ? 'bg-checkered' : ''}`} style={style} title={isGradient ? 'Gradient Fill' : String(fill)} /> );
                                        })}
                                    </div>
                                ) : ( <p className="text-xs text-gray-500 text-center py-2">No fills found.</p> )}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Nested Accordion for Properties */}
                <Accordion>
                    {isImage && onInitiateTrace && (
                        <AccordionItem title="Image Tools" defaultOpen={true}>
                            <div className="space-y-3">
                                <button
                                    onClick={() => onInitiateTrace(selectedObject as ImageObject)}
                                    className="w-full bg-cyan-600 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-md hover:bg-cyan-500 transition-colors shadow-md"
                                >
                                    Trace Image
                                </button>
                            </div>
                        </AccordionItem>
                    )}
                    {/* Layout Section */}
                    <AccordionItem title="Layout & Transform" defaultOpen={true}>
                        <div className="flex bg-slate-800 rounded p-0.5 text-xs border border-slate-700 mb-2 w-fit">
                            <button onClick={() => setDimensionUnits('px')} className={`px-1.5 py-0.5 text-[10px] rounded-sm ${dimensionUnits === 'px' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>px</button>
                            <button onClick={() => setDimensionUnits('mm')} className={`px-1.5 py-0.5 text-[10px] rounded-sm ${dimensionUnits === 'mm' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>mm</button>
                            <button onClick={() => setDimensionUnits('in')} className={`px-1.5 py-0.5 text-[10px] rounded-sm ${dimensionUnits === 'in' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>in</button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">W</label>
                                <input type="number" step={step} value={isSingleSelection ? localDims.width : ''} onChange={handleDimChange('width')} onFocus={() => setFocusedDim('width')} onBlur={() => setFocusedDim(null)} disabled={!isSingleSelection} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">H</label>
                                <input type="number" step={step} value={isSingleSelection ? localDims.height : ''} onChange={handleDimChange('height')} onFocus={() => setFocusedDim('height')} onBlur={() => setFocusedDim(null)} disabled={!isSingleSelection} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">X</label>
                                <input type="number" step={step} value={isSingleSelection ? localDims.x : ''} onChange={handleDimChange('x')} onFocus={() => setFocusedDim('x')} onBlur={() => setFocusedDim(null)} disabled={!isSingleSelection} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Y</label>
                                <input type="number" step={step} value={isSingleSelection ? localDims.y : ''} onChange={handleDimChange('y')} onFocus={() => setFocusedDim('y')} onBlur={() => setFocusedDim(null)} disabled={!isSingleSelection} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <ControlSlider 
                                label="Rotation" 
                                value={isSingleSelection ? selectedObject?.rotation || 0 : 0} 
                                min={-180} max={180} unit="°" 
                                onChange={(val) => onUpdateSelectedObjects({ rotation: val })} 
                                disabled={!isSingleSelection}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <ControlSlider label="Skew X" value={isSingleSelection ? selectedObject?.skewX || 0 : 0} min={-45} max={45} unit="°" onChange={(val) => onUpdateSelectedObjects({ skewX: val })} disabled={!isSingleSelection} />
                            <ControlSlider label="Skew Y" value={isSingleSelection ? selectedObject?.skewY || 0 : 0} min={-45} max={45} unit="°" onChange={(val) => onUpdateSelectedObjects({ skewY: val })} disabled={!isSingleSelection} />
                        </div>
                    </AccordionItem>

                    {/* Fill Section */}
                    {!isImage && (
                        <AccordionItem title="Fill" defaultOpen={true}>
                            <div className="space-y-3">
                                <SegmentedControl 
                                    options={[
                                        { value: 'none', label: 'None' },
                                        { value: 'solid', label: 'Solid' },
                                        { value: 'linear', label: 'Linear' },
                                        { value: 'radial', label: 'Radial' },
                                        ...(canApplyPattern ? [{ value: 'pattern', label: 'Pattern' }] : [])
                                    ]}
                                    value={fillMode}
                                    onChange={handleSetFillType}
                                />
                                
                                {fillMode === 'solid' && typeof selectedObject?.fill === 'string' && selectedObject?.fill !== 'none' && (
                                    <div className="flex items-center space-x-2 bg-gray-800 p-1.5 rounded-md border border-gray-700">
                                        <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: selectedObject.fill }}>
                                            <input type="color" value={selectedObject.fill} onChange={(e) => onUpdateSelectedObjects({ fill: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        </div>
                                        <input type="text" value={selectedObject.fill} onChange={(e) => onUpdateSelectedObjects({ fill: e.target.value })} className="flex-grow bg-transparent text-xs font-mono text-white focus:outline-none" />
                                    </div>
                                )}
                                {(fillMode === 'linear' || fillMode === 'radial') && typeof selectedObject?.fill === 'object' && 'type' in selectedObject.fill && (
                                    <GradientEditor fill={selectedObject.fill} onUpdate={(newFill) => onUpdateSelectedObjects({ fill: newFill })} />
                                )}
                                
                                {fillMode !== 'none' && fillMode !== 'pattern' && (
                                    <ControlSlider label="Fill Opacity" value={selectedObjects[0]?.fillOpacity ?? 1} min={0} max={1} step={0.01} onChange={(val) => onUpdateSelectedObjects({ fillOpacity: val })} />
                                )}

                                {fillMode === 'pattern' && activeLayer && onUpdateActiveLayerSettings && onDensityImageChange && onApplyPatternFill && layers && onUpdateActiveLayer && (
                                    <div className="space-y-3 pt-2">
                                        <div className="border-b border-gray-700 pb-3 mb-3">
                                            <PatternControls 
                                                activeLayer={activeLayer}
                                                onUpdateActiveLayerSettings={onUpdateActiveLayerSettings}
                                                onDensityImageChange={onDensityImageChange}
                                                onApplyPatternFill={onApplyPatternFill}
                                                layers={layers}
                                                onUpdateActiveLayer={onUpdateActiveLayer}
                                                onToolChange={onToolChange}
                                                activeTool={activeTool}
                                            />
                                        </div>
                                        <button 
                                            onClick={onApplyPatternFill}
                                            disabled={activeLayer?.isLocked}
                                            className="w-full bg-green-600 text-white text-xs font-bold uppercase tracking-wider py-3 rounded-md hover:bg-green-500 transition-colors disabled:opacity-50 shadow-md"
                                        >
                                            Generate Pattern Geometry
                                        </button>
                                    </div>
                                )}
                            </div>
                        </AccordionItem>
                    )}

                    {/* Stroke Section */}
                    {!isImage && (
                        <AccordionItem title="Stroke" defaultOpen={false}>
                            <div className="space-y-3">
                                <SegmentedControl 
                                    options={[{ value: 'none', label: 'None' }, { value: 'solid', label: 'Solid' }]}
                                    value={selectedObjects[0]?.stroke === 'none' ? 'none' : 'solid'}
                                    onChange={(val) => {
                                        const update: any = { stroke: val === 'none' ? 'none' : '#000000' };
                                        if (val === 'solid') {
                                            // If enabling stroke and width is 0, set to 1px to make it visible
                                            const currentW = selectedObjects[0]?.strokeWidth ?? 0;
                                            if (currentW <= 0) update.strokeWidth = 1;
                                        }
                                        onUpdateSelectedObjects(update);
                                    }}
                                />

                                {selectedObjects[0]?.stroke !== 'none' && (
                                    <>
                                        <div className="flex items-center space-x-2 bg-gray-800 p-1.5 rounded-md border border-gray-700">
                                            <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: selectedObjects[0]?.stroke || '#000' }}>
                                                <input type="color" value={selectedObjects[0]?.stroke || '#000000'} onChange={(e) => onUpdateSelectedObjects({ stroke: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            </div>
                                            <input type="text" value={selectedObjects[0]?.stroke || ''} onChange={(e) => onUpdateSelectedObjects({ stroke: e.target.value })} className="flex-grow bg-transparent text-xs font-mono text-white focus:outline-none" />
                                        </div>

                                        <ControlSlider label="Width" value={isSingleSelection ? selectedObject?.strokeWidth || 0 : 0} min={0.1} max={50} step={0.1} unit="px" onChange={(val) => onUpdateSelectedObjects({ strokeWidth: val })} disabled={!isSingleSelection} />
                                        <ControlSlider label="Opacity" value={selectedObjects[0]?.strokeOpacity ?? 1} min={0} max={1} step={0.01} onChange={(val) => onUpdateSelectedObjects({ strokeOpacity: val })} />
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <ControlSelect label="Cap" value={selectedObjects[0]?.strokeLinecap || 'butt'} onChange={(val) => onUpdateSelectedObjects({ strokeLinecap: val as any })}>
                                                <option value="butt">Butt</option>
                                                <option value="round">Round</option>
                                                <option value="square">Square</option>
                                            </ControlSelect>
                                            <ControlSelect label="Join" value={selectedObjects[0]?.strokeLinejoin || 'miter'} onChange={(val) => onUpdateSelectedObjects({ strokeLinejoin: val as any })}>
                                                <option value="miter">Miter</option>
                                                <option value="round">Round</option>
                                                <option value="bevel">Bevel</option>
                                            </ControlSelect>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-medium text-gray-500 block mb-1">Dash Array</label>
                                                <input type="text" placeholder="e.g. 4 2" value={selectedObjects[0]?.strokeDasharray || ''} onChange={(e) => onUpdateSelectedObjects({ strokeDasharray: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-medium text-gray-500 block mb-1">Offset</label>
                                                <input type="number" step="1" value={selectedObjects[0]?.strokeDashoffset || 0} onChange={(e) => onUpdateSelectedObjects({ strokeDashoffset: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </AccordionItem>
                    )}

                    {/* Typography Section */}
                    {selectedObject?.type === 'text' && (
                        <AccordionItem title="Typography" defaultOpen={true}>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <ControlSelect label="Family" value={(selectedObject as TextObject).fontFamily} onChange={(val) => onUpdateSelectedObjects({ fontFamily: val })}>
                                        <optgroup label="Google Fonts">{googleFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                                        <optgroup label="Standard Fonts">{standardFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                                    </ControlSelect>
                                    <ControlSelect label="Weight" value={(selectedObject as TextObject).fontWeight} onChange={(val) => onUpdateSelectedObjects({ fontWeight: val })}>
                                        <option value="normal">Normal</option>
                                        <option value="bold">Bold</option>
                                    </ControlSelect>
                                </div>
                                <ControlSlider label="Size" value={(selectedObject as TextObject).fontSize} min={1} max={500} step={1} unit="px" onChange={(val) => onUpdateSelectedObjects({ fontSize: val })} />
                                <ControlSlider label="Line Height" value={(selectedObject as TextObject).lineHeight ?? 1.2} min={0.5} max={3} step={0.1} onChange={(val) => onUpdateSelectedObjects({ lineHeight: val })} />
                                <ControlSlider label="Letter Spacing" value={(selectedObject as TextObject).letterSpacing ?? 0} min={-10} max={50} step={0.5} unit="px" onChange={(val) => onUpdateSelectedObjects({ letterSpacing: val })} />
                                
                                {(selectedObject as TextObject).textPathId && (
                                    <div className="pt-3 border-t border-gray-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-medium text-gray-300">Text on Path</span>
                                            <button onClick={() => onUpdateSelectedObjects({ textPathId: undefined })} className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wide font-bold">Detach</button>
                                        </div>
                                        <div className="space-y-3">
                                            <ControlSlider label="Start Offset" value={(selectedObject as TextObject).textPathStartOffset || 0} min={0} max={100} unit="%" onChange={(val) => onUpdateSelectedObjects({ textPathStartOffset: val })} />
                                            <SegmentedControl 
                                                label="Alignment"
                                                options={[{ value: 'start', label: 'Start' }, { value: 'middle', label: 'Middle' }, { value: 'end', label: 'End' }]}
                                                value={(selectedObject as TextObject).textPathAlign || 'start'}
                                                onChange={(val) => onUpdateSelectedObjects({ textPathAlign: val as any })}
                                            />
                                            <SegmentedControl 
                                                label="Side"
                                                options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
                                                value={(selectedObject as TextObject).textPathSide || 'left'}
                                                onChange={(val) => onUpdateSelectedObjects({ textPathSide: val as any })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AccordionItem>
                    )}

                    {/* Path Settings */}
                    {selectedObject?.type === 'path' && (
                        <AccordionItem title="Path Settings" defaultOpen={true}>
                            <div className="mt-2">
                                <ControlSlider label="Smoothing" value={(selectedObject as PathObject).smoothing} min={0} max={1} step={0.05} onChange={(val) => onUpdateSelectedObjects({ smoothing: val })} />
                            </div>
                        </AccordionItem>
                    )}

                    {/* Appearance Section */}
                    <AccordionItem title="Appearance" defaultOpen={false}>
                        <div className="space-y-3">
                            <ControlSelect 
                                label="Blend Mode" 
                                value={selectedObjects[0]?.blendMode || 'normal'} 
                                onChange={(val) => onUpdateSelectedObjects({ blendMode: val as BlendMode })}
                            >
                                {blendModes.map(mode => <option key={mode} value={mode}>{mode.replace('-', ' ')}</option>)}
                            </ControlSelect>
                        </div>
                    </AccordionItem>
                </Accordion>
            </div>
        );
    }
    
    return null;
};