
import React from 'react';
import type { Layer } from '../../types';
import { ControlSlider } from './CommonControls';

interface LayerTransformControlsProps {
    activeLayer: Layer;
    onUpdateActiveLayer: (updater: (layer: Layer) => void) => void;
}

/**
 * Controls for manipulating the global transform (offset, scale, skew, rotation) of an entire layer.
 * These transforms apply to all objects within the layer.
 */
export const LayerTransformControls: React.FC<LayerTransformControlsProps> = ({ activeLayer, onUpdateActiveLayer }) => {
    const handleValueChange = (field: keyof Layer, value: number) => {
        onUpdateActiveLayer(layer => {
            (layer[field] as number) = value;
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Offset X</label>
                    <input 
                        type="number" 
                        value={activeLayer.offsetX} 
                        onChange={(e) => handleValueChange('offsetX', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" 
                    />
                </div>
                 <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Offset Y</label>
                    <input 
                        type="number" 
                        value={activeLayer.offsetY} 
                        onChange={(e) => handleValueChange('offsetY', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" 
                    />
                </div>
            </div>
            
            <ControlSlider label="Scale" value={activeLayer.scale} min={0.1} max={5} step={0.01} onChange={(val) => handleValueChange('scale', val)} />
            
            <div className="grid grid-cols-2 gap-3">
                <ControlSlider label="Skew X" value={activeLayer.skewX || 0} min={-45} max={45} unit="°" onChange={(val) => handleValueChange('skewX', val)} />
                <ControlSlider label="Skew Y" value={activeLayer.skewY || 0} min={-45} max={45} unit="°" onChange={(val) => handleValueChange('skewY', val)} />
            </div>
            
            <ControlSlider label="Rotation" value={activeLayer.rotation} min={-180} max={180} step={0.5} unit="°" onChange={(val) => handleValueChange('rotation', val)} />
        </div>
    );
};

export default LayerTransformControls;
