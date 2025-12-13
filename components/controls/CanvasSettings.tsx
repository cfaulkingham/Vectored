import React, { useState, useEffect, useCallback } from 'react';
import type { Units } from '../../types';

interface CanvasSettingsProps {
    units: Units;
    onUnitsChange: (units: Units) => void;
    canvasConfig: { width: number, height: number };
    onCanvasConfigChange: (config: { width: number, height: number }) => void;
    dpi: number;
}

/**
 * Component for managing canvas dimensions and units of measurement.
 * Allows switching between millimeters, inches, and pixels and updating width/height.
 * Handles conversion between display units and internal pixel values based on DPI.
 */
const CanvasSettings: React.FC<CanvasSettingsProps> = ({ units, onUnitsChange, canvasConfig, onCanvasConfigChange, dpi }) => {
    const convertFromPx = useCallback((px: number) => {
        if (units === 'mm') return (px * 25.4) / dpi;
        if (units === 'in') return px / dpi;
        return px;
    }, [units, dpi]);

    const convertToPx = useCallback((unitValue: number) => {
        if (units === 'mm') return (unitValue * dpi) / 25.4;
        if (units === 'in') return unitValue * dpi;
        return unitValue;
    }, [units, dpi]);

    const [localConfig, setLocalConfig] = useState({ width: '', height: '' });
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    useEffect(() => {
        if (focusedInput) return;
        const precision = units === 'px' ? 0 : 1;
        setLocalConfig({
            width: convertFromPx(canvasConfig.width).toFixed(precision),
            height: convertFromPx(canvasConfig.height).toFixed(precision),
        });
    }, [canvasConfig, convertFromPx, focusedInput, units]);

    const handleConfigChange = (field: 'width' | 'height') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const valueStr = e.target.value;
        setLocalConfig(prev => ({ ...prev, [field]: valueStr }));
        const valueNum = parseFloat(valueStr);
        if (!isNaN(valueNum) && valueNum > 0) {
            onCanvasConfigChange({ ...canvasConfig, [field]: convertToPx(valueNum) });
        }
    };
    
    return (
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-300">Units</label>
                <div className="flex bg-gray-900 rounded-lg p-1">
                    <button onClick={() => onUnitsChange('mm')}
                        className={`px-2 py-1 text-xs rounded-md transition-colors duration-200 ${units === 'mm' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'}`}>
                        mm
                    </button>
                    <button onClick={() => onUnitsChange('in')}
                        className={`px-2 py-1 text-xs rounded-md transition-colors duration-200 ${units === 'in' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'}`}>
                        in
                    </button>
                    <button onClick={() => onUnitsChange('px')}
                        className={`px-2 py-1 text-xs rounded-md transition-colors duration-200 ${units === 'px' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'}`}>
                        px
                    </button>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-300">W:</label>
                <input
                    type="number"
                    value={localConfig.width}
                    onChange={handleConfigChange('width')}
                    onFocus={() => setFocusedInput('width')}
                    onBlur={() => setFocusedInput(null)}
                    className="w-16 bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:border-cyan-500 outline-none"
                />
            </div>
            <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-300">H:</label>
                <input
                    type="number"
                    value={localConfig.height}
                    onChange={handleConfigChange('height')}
                    onFocus={() => setFocusedInput('height')}
                    onBlur={() => setFocusedInput(null)}
                    className="w-16 bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:border-cyan-500 outline-none"
                />
            </div>
        </div>
    );
};

export default CanvasSettings;
