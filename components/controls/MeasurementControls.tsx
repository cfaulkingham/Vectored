
import React from 'react';
import type { MeasurementObject } from '../../types';
import { ControlSlider, ControlSelect, SectionHeader, SegmentedControl } from './CommonControls';
import { googleFonts } from '../../lib/utils';

interface MeasurementControlsProps {
    object: MeasurementObject;
    onUpdate: (props: Partial<MeasurementObject>) => void;
}

const standardFonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];

/**
 * Controls for configuring Measurement objects.
 * Allows editing the measurement type (distance, angle, area), text styling, and explicit start/end points.
 * Handles smart measurements linked to other objects.
 */
export const MeasurementControls: React.FC<MeasurementControlsProps> = ({ object, onUpdate }) => {
    
    const isSmart = !!object.referenceId;
    
    return (
        <div className="space-y-4">
            {isSmart && (
                <div>
                    <SectionHeader title="Smart Measurement" />
                    <div className="mt-2">
                        <ControlSelect 
                            label="Type" 
                            value={object.measurementType || 'distance'} 
                            onChange={(val) => onUpdate({ measurementType: val as any })}
                        >
                            <option value="distance">Distance</option>
                            <option value="radius">Radius</option>
                            <option value="diameter">Diameter</option>
                            <option value="circumference">Circumference</option>
                            <option value="area">Area</option>
                            <option value="perimeter">Perimeter/Length</option>
                        </ControlSelect>
                        <p className="text-[10px] text-gray-500 mt-1 italic">
                            Linked to object. Will update automatically if possible.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <SectionHeader title="Display Options" />
                <div className="space-y-3 mt-2">
                    <div>
                        <label className="text-xs font-medium text-gray-400 block mb-1">Line Color</label>
                        <div className="flex items-center space-x-2 bg-gray-800 p-1.5 rounded-md border border-gray-700">
                            <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: object.stroke || '#000' }}>
                                 <input type="color" value={object.stroke || '#000000'} onChange={(e) => onUpdate({ stroke: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                            <input type="text" value={object.stroke || ''} onChange={(e) => onUpdate({ stroke: e.target.value })} className="flex-grow bg-transparent text-xs font-mono text-white focus:outline-none" />
                        </div>
                    </div>

                    {(object.measurementType === 'distance' || !object.measurementType) && (
                        <>
                            <ControlSlider label="Spacing" value={object.measurementOffset ?? 20} min={-200} max={200} unit="px" onChange={(val) => onUpdate({ measurementOffset: val })} />
                            
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-400 select-none">Show Length</label>
                                <button onClick={() => onUpdate({ showLength: !object.showLength })} className={`${object.showLength ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-5 rounded-full w-9 transition-colors`}>
                                    <span className={`${object.showLength ? 'translate-x-4' : 'translate-x-1'} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-400 select-none">Show Angle</label>
                                <button onClick={() => onUpdate({ showAngle: !object.showAngle })} className={`${object.showAngle ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-5 rounded-full w-9 transition-colors`}>
                                    <span className={`${object.showAngle ? 'translate-x-4' : 'translate-x-1'} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div>
                <SectionHeader title="Typography" />
                <div className="mt-2 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-gray-400 block mb-1">Text Color</label>
                        <div className="flex items-center space-x-2 bg-gray-800 p-1.5 rounded-md border border-gray-700">
                            <div className="w-6 h-6 rounded border border-gray-600 relative overflow-hidden" style={{ backgroundColor: object.textColor || '#000' }}>
                                 <input type="color" value={object.textColor || '#000000'} onChange={(e) => onUpdate({ textColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                            <input type="text" value={object.textColor || ''} onChange={(e) => onUpdate({ textColor: e.target.value })} className="flex-grow bg-transparent text-xs font-mono text-white focus:outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <ControlSelect label="Family" value={object.fontFamily} onChange={(val) => onUpdate({ fontFamily: val })}>
                            <optgroup label="Google Fonts">{googleFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                            <optgroup label="Standard Fonts">{standardFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                        </ControlSelect>
                        <ControlSelect label="Weight" value={object.fontWeight} onChange={(val) => onUpdate({ fontWeight: val })}>
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                        </ControlSelect>
                    </div>
                    <ControlSlider label="Font Size" value={object.fontSize} min={5} max={100} unit="px" onChange={(val) => onUpdate({ fontSize: val })} />
                </div>
            </div>

            <div>
                <SectionHeader title="Geometry" />
                <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Start X</label>
                            <input type="number" value={object.x1.toFixed(1)} onChange={(e) => onUpdate({ x1: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Start Y</label>
                            <input type="number" value={object.y1.toFixed(1)} onChange={(e) => onUpdate({ y1: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">End X</label>
                            <input type="number" value={object.x2.toFixed(1)} onChange={(e) => onUpdate({ x2: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">End Y</label>
                            <input type="number" value={object.y2.toFixed(1)} onChange={(e) => onUpdate({ y2: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
