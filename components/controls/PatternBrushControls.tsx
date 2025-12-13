
import React from 'react';
import type { Layer, LayerSettings, BrushPatternType } from '../../types';
import { StippleIcon, WordsIcon, HatchIcon, CirclesIcon } from './Icons';
import { googleFonts } from '../../lib/utils';
import { ControlSlider, ControlSelect, SectionHeader } from './CommonControls';

interface PatternBrushControlsProps {
    activeLayer: Layer;
    onUpdateActiveLayerSettings: (settings: Partial<LayerSettings>) => void;
    onUpdateActiveLayer: (updater: (layer: Layer) => void) => void;
}

const standardFonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];

/**
 * Controls for the Pattern Brush tool.
 * Allows selecting the brush pattern type (Stipple, Words, Hatch, Circles) and configuring its properties
 * such as size, density, jitter, and specific settings for words or strokes.
 */
export const PatternBrushControls: React.FC<PatternBrushControlsProps> = ({ activeLayer, onUpdateActiveLayerSettings, onUpdateActiveLayer }) => {
    const { settings, color } = activeLayer;

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateActiveLayer(layer => {
            layer.color = e.target.value;
        });
    };
    
    return (
        <fieldset disabled={activeLayer.isLocked} className="space-y-4 disabled:opacity-50">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-medium text-gray-400">Brush Pattern</label>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="brush-color-picker" className="text-[10px] font-medium text-gray-500">Color</label>
                        <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: color }}>
                            <input id="brush-color-picker" type="color" value={color} onChange={handleColorChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Change brush color" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {(['stipple', 'words', 'hatch', 'circles'] as BrushPatternType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => onUpdateActiveLayerSettings({ brushPatternType: type })}
                            className={`p-2 rounded transition-all duration-200 ${settings.brushPatternType === type ? 'bg-cyan-600 text-white shadow-md' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200'}`}
                            title={type.charAt(0).toUpperCase() + type.slice(1)}
                        >
                            {type === 'stipple' && <StippleIcon className="w-5 h-5 mx-auto" />}
                            {type === 'words' && <WordsIcon className="w-5 h-5 mx-auto" />}
                            {type === 'hatch' && <HatchIcon className="w-5 h-5 mx-auto" />}
                            {type === 'circles' && <CirclesIcon className="w-5 h-5 mx-auto" />}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <SectionHeader title="Properties" />
                <div className="mt-2 space-y-3">
                    <ControlSlider label="Size" value={settings.brushSize} min={1} max={200} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ brushSize: val })} />
                    <ControlSlider label="Density" value={settings.brushDensity} min={0.01} max={1} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ brushDensity: val })} />
                    <div className="grid grid-cols-2 gap-3">
                        <ControlSlider label="Scale Jitter" value={settings.brushScaleJitter} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ brushScaleJitter: val })} />
                        <ControlSlider label="Angle Jitter" value={settings.brushAngleJitter} min={0} max={180} unit="°" onChange={(val) => onUpdateActiveLayerSettings({ brushAngleJitter: val })} />
                    </div>
                </div>
            </div>

            {settings.brushPatternType === 'words' && (
                 <div className="space-y-3">
                     <SectionHeader title="Word Settings" />
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Growth Mode</label>
                        <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700">
                            <button onClick={() => onUpdateActiveLayerSettings({ wordBrushGrowthMode: 'random' })} className={`flex-1 py-1 text-xs rounded transition ${settings.wordBrushGrowthMode === 'random' || !settings.wordBrushGrowthMode ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Random</button>
                            <button onClick={() => onUpdateActiveLayerSettings({ wordBrushGrowthMode: 'grow' })} className={`flex-1 py-1 text-xs rounded transition ${settings.wordBrushGrowthMode === 'grow' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Grow</button>
                            <button onClick={() => onUpdateActiveLayerSettings({ wordBrushGrowthMode: 'shrink' })} className={`flex-1 py-1 text-xs rounded transition ${settings.wordBrushGrowthMode === 'shrink' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Shrink</button>
                        </div>
                    </div>
                     <div>
                         <label htmlFor="word-text-brush" className="block text-xs font-medium text-gray-400 mb-1">Text</label>
                         <textarea id="word-text-brush" value={settings.wordText} onChange={(e) => onUpdateActiveLayerSettings({ wordText: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500" rows={2}/>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <ControlSelect label="Font" value={settings.wordFontFamily} onChange={(val) => onUpdateActiveLayerSettings({ wordFontFamily: val })}>
                            <optgroup label="Google Fonts">{googleFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                            <optgroup label="Standard Fonts">{standardFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                        </ControlSelect>
                        <ControlSelect label="Weight" value={settings.wordFontWeight} onChange={(val) => onUpdateActiveLayerSettings({ wordFontWeight: val })}>
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                        </ControlSelect>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <ControlSlider label="Min Size" value={settings.wordMinFontSize} min={6} max={300} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ wordMinFontSize: Math.min(val, settings.wordMaxFontSize - 1) })} />
                       <ControlSlider label="Max Size" value={settings.wordMaxFontSize} min={6} max={300} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ wordMaxFontSize: Math.max(val, settings.wordMinFontSize + 1)})} />
                    </div>
                 </div>
            )}

            {(settings.brushPatternType === 'stipple' || settings.brushPatternType === 'circles') && (
                <div>
                    <SectionHeader title="Circle Settings" />
                    <div className="mt-2 grid grid-cols-2 gap-3">
                       <ControlSlider label="Min Radius" value={settings.minCircleRadius} min={0} max={50} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ minCircleRadius: Math.min(val, settings.maxCircleRadius - 0.5) })} />
                       <ControlSlider label="Max Radius" value={settings.maxCircleRadius} min={0.5} max={50} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ maxCircleRadius: Math.max(val, settings.minCircleRadius + 0.5)})} />
                    </div>
                </div>
            )}

            {settings.brushPatternType === 'hatch' && (
                <div>
                    <SectionHeader title="Hatch Settings" />
                    <div className="mt-2">
                        <ControlSlider label="Stroke Width" value={settings.strokeWidth} min={0.5} max={10} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ strokeWidth: val })} />
                    </div>
                </div>
            )}
        </fieldset>
    );
};

export default PatternBrushControls;
