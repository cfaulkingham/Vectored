import React from 'react';
import type { Gradient } from '../../types';

interface GradientEditorProps {
    fill: Gradient;
    onUpdate: (newFill: Gradient) => void;
}

/**
 * A dedicated editor for linear and radial gradients.
 * Allows adding/removing stops, changing colors and offsets, and adjusting angle or center.
 */
export const GradientEditor: React.FC<GradientEditorProps> = ({ fill, onUpdate }) => {

    const handleGradientPropChange = (prop: string, value: number) => {
        const newFill = { ...fill, [prop]: value };
        onUpdate(newFill as Gradient);
    };

    const handleStopColorChange = (index: number, color: string) => {
        const newStops = [...fill.stops];
        newStops[index] = { ...newStops[index], color };
        onUpdate({ ...fill, stops: newStops });
    };

    const handleStopOffsetChange = (index: number, offset: number) => {
        const newStops = [...fill.stops];
        newStops[index] = { ...newStops[index], offset };
        newStops.sort((a, b) => a.offset - b.offset);
        onUpdate({ ...fill, stops: newStops });
    };

    const handleAddStop = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        
        // Find insert index to interpolate color
        const nextStopIndex = fill.stops.findIndex(s => s.offset > offset);
        let color = '#ffffff';
        if (nextStopIndex === -1 && fill.stops.length > 0) { // Add at end
            color = fill.stops[fill.stops.length - 1].color;
        } else if (nextStopIndex === 0 && fill.stops.length > 0) { // Add at beginning
            color = fill.stops[0].color;
        } else if (fill.stops.length > 1) { // Interpolate
            const prevStop = fill.stops[nextStopIndex - 1];
            const nextStop = fill.stops[nextStopIndex];
            const t = (offset - prevStop.offset) / (nextStop.offset - prevStop.offset);
            
            const r1 = parseInt(prevStop.color.slice(1, 3), 16);
            const g1 = parseInt(prevStop.color.slice(3, 5), 16);
            const b1 = parseInt(prevStop.color.slice(5, 7), 16);
            const r2 = parseInt(nextStop.color.slice(1, 3), 16);
            const g2 = parseInt(nextStop.color.slice(3, 5), 16);
            const b2 = parseInt(nextStop.color.slice(5, 7), 16);

            const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
            const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
            const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
            color = `#${r}${g}${b}`;
        }

        const newStops = [...fill.stops, { offset, color }];
        newStops.sort((a, b) => a.offset - b.offset);
        onUpdate({ ...fill, stops: newStops });
    };

    const handleRemoveStop = (index: number) => {
        if (fill.stops.length <= 2) return;
        const newStops = fill.stops.filter((_, i) => i !== index);
        onUpdate({ ...fill, stops: newStops });
    };
    
    const gradientPreview = `linear-gradient(to right, ${[...fill.stops].sort((a,b) => a.offset - b.offset).map(s => `${s.color} ${s.offset*100}%`).join(', ')})`;

    return (
        <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-300">Stops</label>
                <div className="w-full h-8 mt-1 rounded bg-checkered relative" style={{ background: gradientPreview }} onClick={handleAddStop}>
                    {fill.stops.map((stop, i) => (
                        <div key={i} className="absolute top-0 -translate-x-1/2" style={{ left: `${stop.offset * 100}%`}}>
                            <div className="h-full w-px bg-white/50" />
                            <div className="w-4 h-4 rounded-full bg-white border-2 border-gray-800 absolute -top-1 -left-2" />
                        </div>
                    ))}
                </div>
                <div className="space-y-2 mt-2">
                    {fill.stops.map((stop, i) => (
                        <div key={i} className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded border border-gray-500 relative shrink-0" style={{ backgroundColor: stop.color }}>
                                 <input type="color" value={stop.color} onChange={e => handleStopColorChange(i, e.target.value)} className="w-full h-full opacity-0 cursor-pointer" title="Change stop color" />
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={stop.offset} onChange={e => handleStopOffsetChange(i, Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                            <span className="text-xs font-mono w-10 text-right text-cyan-400">{(stop.offset*100).toFixed(0)}%</span>
                            <button onClick={() => handleRemoveStop(i)} disabled={fill.stops.length <= 2} className="text-gray-400 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed text-xl">&times;</button>
                        </div>
                    ))}
                </div>
            </div>
            {fill.type === 'linear' && (
                <div>
                    <label htmlFor="grad-angle" className="flex justify-between text-sm font-medium text-gray-300">Angle<span className="font-mono text-cyan-400">{fill.angle.toFixed(0)}°</span></label>
                    <input id="grad-angle" type="range" min="0" max="360" value={fill.angle} onChange={e => handleGradientPropChange('angle', Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-1" />
                </div>
            )}
            {fill.type === 'radial' && (
                <div className="space-y-3">
                    <div>
                        <label htmlFor="grad-cx" className="flex justify-between text-sm font-medium text-gray-300">Center X<span className="font-mono text-cyan-400">{fill.cx.toFixed(2)}</span></label>
                        <input id="grad-cx" type="range" min="0" max="1" step="0.01" value={fill.cx} onChange={e => handleGradientPropChange('cx', Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-1" />
                    </div>
                     <div>
                        <label htmlFor="grad-cy" className="flex justify-between text-sm font-medium text-gray-300">Center Y<span className="font-mono text-cyan-400">{fill.cy.toFixed(2)}</span></label>
                        <input id="grad-cy" type="range" min="0" max="1" step="0.01" value={fill.cy} onChange={e => handleGradientPropChange('cy', Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-1" />
                    </div>
                     <div>
                        <label htmlFor="grad-r" className="flex justify-between text-sm font-medium text-gray-300">Radius<span className="font-mono text-cyan-400">{fill.r.toFixed(2)}</span></label>
                        <input id="grad-r" type="range" min="0" max="1.5" step="0.01" value={fill.r} onChange={e => handleGradientPropChange('r', Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-1" />
                    </div>
                </div>
            )}
        </div>
    );
};