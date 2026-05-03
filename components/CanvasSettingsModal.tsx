
import React, { useState, useEffect, useCallback } from 'react';
import type { Units } from '../types';
import { FileIcon } from './controls/Icons';

interface CanvasSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    units: Units;
    onUnitsChange?: (units: Units) => void;
    canvasConfig: { width: number, height: number, clipToCanvas?: boolean };
    onCanvasConfigChange?: (config: { width: number, height: number, clipToCanvas?: boolean }) => void;
    onConfirm?: (config: { width: number, height: number, clipToCanvas?: boolean }, units: Units) => void;
    dpi: number;
    mode?: 'edit' | 'create';
    includeMeasurements?: boolean;
    onIncludeMeasurementsChange?: (value: boolean) => void;
}

const PRESETS = [
    { name: 'Letter', width: 8.5, height: 11, unit: 'in' },
    { name: 'Legal', width: 8.5, height: 14, unit: 'in' },
    { name: 'Tabloid', width: 11, height: 17, unit: 'in' },
    { name: 'A4', width: 210, height: 297, unit: 'mm' },
    { name: 'A3', width: 297, height: 420, unit: 'mm' },
    { name: 'A5', width: 148, height: 210, unit: 'mm' },
    { name: 'Business Card', width: 3.5, height: 2, unit: 'in' },
    { name: 'Postcard', width: 6, height: 4, unit: 'in' },
    { name: 'Screen 1080p', width: 1920, height: 1080, unit: 'px' },
    { name: 'Screen 720p', width: 1280, height: 720, unit: 'px' },
    { name: 'Instagram Post', width: 1080, height: 1080, unit: 'px' },
];

/**
 * Modal dialog for configuring canvas settings (width, height, units).
 * Supports both creating a new project and editing existing canvas dimensions.
 * Includes predefined presets for common paper sizes and screen resolutions.
 */
const CanvasSettingsModal: React.FC<CanvasSettingsModalProps> = ({ 
    isOpen, onClose, units: initialUnits, onUnitsChange, canvasConfig: initialConfig, onCanvasConfigChange, onConfirm, dpi, mode = 'edit', includeMeasurements, onIncludeMeasurementsChange 
}) => {
    const [localUnits, setLocalUnits] = useState<Units>(initialUnits);
    const [localConfig, setLocalConfig] = useState({ width: '', height: '' });
    const [localClipToCanvas, setLocalClipToCanvas] = useState(initialConfig.clipToCanvas ?? false);
    
    const convertFromPx = useCallback((px: number, unit: Units) => {
        if (unit === 'mm') return (px * 25.4) / dpi;
        if (unit === 'in') return px / dpi;
        return px;
    }, [dpi]);

    const convertToPx = useCallback((unitValue: number, unit: Units) => {
        if (unit === 'mm') return (unitValue * dpi) / 25.4;
        if (unit === 'in') return unitValue * dpi;
        return unitValue;
    }, [dpi]);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalUnits(initialUnits);
            setLocalConfig({
                width: convertFromPx(initialConfig.width, initialUnits).toFixed(2),
                height: convertFromPx(initialConfig.height, initialUnits).toFixed(2),
            });
            setLocalClipToCanvas(initialConfig.clipToCanvas ?? false);
        }
    }, [isOpen, initialConfig, initialUnits, convertFromPx]);

    const handleUnitChange = (newUnit: Units) => {
        // Convert current value to new unit
        const wPx = convertToPx(parseFloat(localConfig.width) || 0, localUnits);
        const hPx = convertToPx(parseFloat(localConfig.height) || 0, localUnits);
        
        setLocalUnits(newUnit);
        setLocalConfig({
            width: convertFromPx(wPx, newUnit).toFixed(2),
            height: convertFromPx(hPx, newUnit).toFixed(2),
        });
    };

    const handleConfigChange = (field: 'width' | 'height') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const valueStr = e.target.value;
        setLocalConfig(prev => ({ ...prev, [field]: valueStr }));
    };

    const handlePresetClick = (preset: typeof PRESETS[0]) => {
        setLocalUnits(preset.unit as Units);
        setLocalConfig({
            width: preset.width.toString(),
            height: preset.height.toString(),
        });
    };

    const handleSave = () => {
        const w = parseFloat(localConfig.width);
        const h = parseFloat(localConfig.height);
        
        if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
            const wPx = convertToPx(w, localUnits);
            const hPx = convertToPx(h, localUnits);

            if (mode === 'create' && onConfirm) {
                onConfirm({ width: wPx, height: hPx, clipToCanvas: localClipToCanvas }, localUnits);
            } else if (onCanvasConfigChange && onUnitsChange) {
                onCanvasConfigChange({ width: wPx, height: hPx, clipToCanvas: localClipToCanvas });
                onUnitsChange(localUnits);
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl text-gray-200 flex flex-col md:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Presets Sidebar */}
                <div className="w-full md:w-1/3 bg-gray-900/50 border-b md:border-b-0 md:border-r border-gray-700 p-4 flex flex-col">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Presets</h3>
                    <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-grow max-h-40 md:max-h-[300px]">
                        {PRESETS.map((preset, i) => (
                            <button 
                                key={i} 
                                onClick={() => handlePresetClick(preset)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center group"
                            >
                                <FileIcon className="w-4 h-4 text-gray-500 mr-3 group-hover:text-cyan-400" />
                                <div>
                                    <div className="text-sm font-medium text-gray-300 group-hover:text-white">{preset.name}</div>
                                    <div className="text-xs text-gray-500">{preset.width} x {preset.height} {preset.unit}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    <header className="flex items-center justify-between p-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold">{mode === 'create' ? 'New Project' : 'Canvas Settings'}</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                    </header>
                    
                    <main className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Units</label>
                            <div className="flex bg-gray-700 rounded-lg p-1">
                                <button onClick={() => handleUnitChange('mm')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${localUnits === 'mm' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Millimeters</button>
                                <button onClick={() => handleUnitChange('in')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${localUnits === 'in' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Inches</button>
                                <button onClick={() => handleUnitChange('px')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${localUnits === 'px' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pixels</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="modal-width" className="block text-sm font-medium text-gray-300 mb-1">Width</label>
                                <div className="relative">
                                    <input id="modal-width" type="number" step="0.1" value={localConfig.width} onChange={handleConfigChange('width')} className="w-full bg-gray-700 rounded-lg p-2 pr-8 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                    <span className="absolute right-3 top-2 text-gray-500 text-sm">{localUnits}</span>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="modal-height" className="block text-sm font-medium text-gray-300 mb-1">Height</label>
                                <div className="relative">
                                    <input id="modal-height" type="number" step="0.1" value={localConfig.height} onChange={handleConfigChange('height')} className="w-full bg-gray-700 rounded-lg p-2 pr-8 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                    <span className="absolute right-3 top-2 text-gray-500 text-sm">{localUnits}</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-700 space-y-3">
                            <div className="flex items-center">
                                <input type="checkbox" id="clip-to-canvas" checked={localClipToCanvas} onChange={(e) => setLocalClipToCanvas(e.target.checked)} className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500" />
                                <label htmlFor="clip-to-canvas" className="ml-2 font-medium text-gray-300 select-none">Clip Content to Artboard</label>
                            </div>
                            {onIncludeMeasurementsChange && (
                                <div className="flex items-center">
                                    <input type="checkbox" id="include-measurements-settings" checked={!!includeMeasurements} onChange={(e) => onIncludeMeasurementsChange(e.target.checked)} className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500" />
                                    <label htmlFor="include-measurements-settings" className="ml-2 font-medium text-gray-300 select-none">Include Measurements in Export/Print</label>
                                </div>
                            )}
                        </div>
                    </main>

                    <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3 mt-auto">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">
                            {mode === 'create' ? 'Create Project' : 'Apply Changes'}
                        </button>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default CanvasSettingsModal;
