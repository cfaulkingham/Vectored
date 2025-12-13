
import React, { useState, useEffect } from 'react';
import type { VectorObject, VectorObjectType, Gradient, BlendMode, TextObject } from '../../types';
import { GradientEditor } from './GradientEditor';
import { googleFonts, invertHexColor } from '../../lib/utils';
import { ControlSlider, SegmentedControl, ControlSelect, SectionHeader } from './CommonControls';

interface ToolPropertiesControlsProps {
    settings: Partial<VectorObject & TextObject>;
    onUpdate: (props: Partial<VectorObject>) => void;
    activeTool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure';
}

const standardFonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];
const blendModes: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

/**
 * Controls for setting the default properties of tools before drawing.
 * Allows configuring fill, stroke, opacity, and typography settings that will be applied to newly created objects.
 */
export const ToolPropertiesControls: React.FC<ToolPropertiesControlsProps> = ({ settings, onUpdate, activeTool }) => {

    const getFillMode = (): 'none' | 'solid' | 'linear' | 'radial' => {
        const fill = settings.fill;
        if (fill === 'none') return 'none';
        if (typeof fill === 'string') return 'solid';
        if (fill && typeof fill === 'object' && 'type' in fill) {
            return fill.type;
        }
        return 'solid';
    };

    const [fillMode, setFillMode] = useState<'none' | 'solid' | 'linear' | 'radial'>(getFillMode());

    useEffect(() => {
        setFillMode(getFillMode());
    }, [settings.fill]);

    const handleSetFillType = (type: string) => {
        const mode = type as 'none' | 'solid' | 'linear' | 'radial';
        setFillMode(mode);

        if (mode === 'none') {
            onUpdate({ fill: 'none' });
            return;
        }

        let newFill: string | Gradient;
        const currentFill = settings.fill;
        const currentColor = typeof currentFill === 'string' ? (currentFill === 'none' ? '#ffffff' : currentFill) : currentFill.stops[0].color;
        const endColor = typeof currentFill === 'string' ? invertHexColor(currentColor) : currentFill.stops[currentFill.stops.length - 1].color;

        if (mode === 'solid') {
            newFill = currentColor;
        } else if (mode === 'linear') {
            newFill = { type: 'linear', angle: 90, stops: [{ offset: 0, color: currentColor }, { offset: 1, color: endColor }] };
        } else { // radial
            newFill = { type: 'radial', cx: 0.5, cy: 0.5, r: 0.5, stops: [{ offset: 0, color: currentColor }, { offset: 1, color: endColor }] };
        }
        onUpdate({ fill: newFill });
    };

    return (
        <div className="space-y-4">
            <div>
                <SectionHeader title="Appearance" />
                <div className="mt-2 space-y-3">
                     <ControlSelect label="Blend Mode" value={settings.blendMode || 'normal'} onChange={(val) => onUpdate({ blendMode: val as BlendMode })}>
                        {blendModes.map(mode => <option key={mode} value={mode}>{mode.replace('-', ' ')}</option>)}
                     </ControlSelect>
                </div>
            </div>

            <div>
                <SectionHeader title="Fill" />
                <div className="mt-2 space-y-3">
                    <SegmentedControl 
                        options={[{ value: 'none', label: 'None' }, { value: 'solid', label: 'Solid' }, { value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]}
                        value={fillMode}
                        onChange={handleSetFillType}
                    />
                    
                    {fillMode === 'solid' && typeof settings.fill === 'string' && (
                        <div className="flex items-center space-x-2 bg-gray-800 p-1.5 rounded-md border border-gray-700">
                            <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: settings.fill }}>
                                 <input type="color" value={settings.fill} onChange={e => onUpdate({ fill: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                            <input type="text" value={settings.fill} onChange={e => onUpdate({ fill: e.target.value })} className="flex-grow bg-transparent text-xs font-mono text-white focus:outline-none" />
                        </div>
                    )}
                    {(fillMode === 'linear' || fillMode === 'radial') && typeof settings.fill === 'object' && 'type' in settings.fill && (
                        <GradientEditor fill={settings.fill} onUpdate={(newFill) => onUpdate({ fill: newFill })} />
                    )}
                    {fillMode !== 'none' && (
                        <ControlSlider label="Fill Opacity" value={settings.fillOpacity ?? 1} min={0} max={1} step={0.01} onChange={(val) => onUpdate({ fillOpacity: val })} />
                    )}
                </div>
            </div>

            <div>
                <SectionHeader title="Stroke" />
                <div className="mt-2 space-y-3">
                     <SegmentedControl 
                        options={[{ value: 'none', label: 'None' }, { value: 'solid', label: 'Solid' }]}
                        value={settings.stroke === 'none' ? 'none' : 'solid'}
                        onChange={(val) => {
                            const update: any = { stroke: val === 'none' ? 'none' : '#000000' };
                            if (val === 'solid') {
                                const currentW = settings.strokeWidth ?? 0;
                                if (currentW <= 0) update.strokeWidth = 1;
                            }
                            onUpdate(update);
                        }}
                    />
                     {settings.stroke !== 'none' && (
                        <>
                            <div className="flex items-center space-x-2 bg-gray-800 p-1.5 rounded-md border border-gray-700">
                                <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: settings.stroke || '#000' }}>
                                     <input type="color" value={settings.stroke || '#000000'} onChange={e => onUpdate({ stroke: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                                <input type="text" value={settings.stroke || ''} onChange={e => onUpdate({ stroke: e.target.value })} className="flex-grow bg-transparent text-xs font-mono text-white focus:outline-none" />
                            </div>
                            <ControlSlider label="Width" value={settings.strokeWidth || 1} min={0.1} max={50} step={0.1} unit="px" onChange={(val) => onUpdate({ strokeWidth: val })} />
                            <ControlSlider label="Opacity" value={settings.strokeOpacity ?? 1} min={0} max={1} step={0.01} onChange={(val) => onUpdate({ strokeOpacity: val })} />
                        </>
                    )}
                </div>
            </div>

            {/* Text Section */}
            {activeTool === 'text' && (
                <div>
                    <SectionHeader title="Typography" />
                    <div className="mt-2 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSelect label="Family" value={settings.fontFamily || 'Roboto'} onChange={(val) => onUpdate({ fontFamily: val })}>
                                <optgroup label="Google Fonts">{googleFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                                <optgroup label="Standard Fonts">{standardFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                            </ControlSelect>
                            <ControlSelect label="Weight" value={settings.fontWeight || 'normal'} onChange={(val) => onUpdate({ fontWeight: val })}>
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                            </ControlSelect>
                        </div>
                        <ControlSlider label="Size" value={settings.fontSize || 48} min={1} max={500} step={1} unit="px" onChange={(val) => onUpdate({ fontSize: val })} />
                        <ControlSlider label="Line Height" value={settings.lineHeight ?? 1.2} min={0.5} max={3} step={0.1} onChange={(val) => onUpdate({ lineHeight: val })} />
                        <ControlSlider label="Letter Spacing" value={settings.letterSpacing ?? 0} min={-10} max={50} step={0.5} unit="px" onChange={(val) => onUpdate({ letterSpacing: val })} />
                    </div>
                </div>
            )}
        </div>
    );
};
