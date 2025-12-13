import React, { useState, useEffect, useMemo } from 'react';
import type { ImageObject } from '../types';
import { ControlSlider, ControlSelect, SectionHeader } from './controls/CommonControls';
import { imageTracer, blur, getSvgString } from '../imagetracer';
import { OPTION_PRESETS } from '../imagetracer/presets';

interface TraceImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageObject: ImageObject;
    onApply: (tracedata: any) => void;
}

/**
 * Modal for converting a raster image to vector paths using ImageTracer.js.
 * Provides controls for tracing parameters and a live preview.
 */
const TraceImageModal: React.FC<TraceImageModalProps> = ({ isOpen, onClose, imageObject, onApply }) => {
    const [params, setParams] = useState({
        ...OPTION_PRESETS.default,
        pathOmit: OPTION_PRESETS.default.pathomit, // Align naming
    });
    const [preset, setPreset] = useState<keyof typeof OPTION_PRESETS>('default');
    const [previewSvg, setPreviewSvg] = useState<string | null>(null);
    const [tracedata, setTracedata] = useState<any | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePresetChange = (newPresetKey: string) => {
        const newPreset = newPresetKey as keyof typeof OPTION_PRESETS;
        setPreset(newPreset);
        
        const presetOptions = { ...OPTION_PRESETS.default, ...OPTION_PRESETS[newPreset] };

        setParams({
            ...presetOptions,
            pathOmit: presetOptions.pathomit,
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        setIsProcessing(true);
        setPreviewSvg(null);
        setTracedata(null);

        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.error("Could not get canvas context for tracing.");
                    setIsProcessing(false);
                    return;
                }
                
                ctx.drawImage(img, 0, 0);
                const originalImageData = ctx.getImageData(0, 0, img.width, img.height);
                
                const presetBaseOptions = { ...OPTION_PRESETS.default, ...OPTION_PRESETS[preset] };
                let imageDataToProcess = originalImageData;

                if (params.blurradius > 0) {
                    imageDataToProcess = blur(originalImageData, params.blurradius, presetBaseOptions.blurdelta);
                }

                const options = {
                    ...presetBaseOptions, // Start with preset to get non-UI values like blurdelta
                    ...params, // Override with user-tweaked params
                    pathomit: params.pathOmit,
                };
                
                const td = imageTracer.imageDataToTracedata(imageDataToProcess, options);
                setTracedata(td);

                const svgString = getSvgString(td, { ...options, scale: 1, viewbox: true });
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
                const svgContent = Array.from(svgDoc.documentElement.children).map(child => child.outerHTML).join('');
                setPreviewSvg(svgContent);

            } catch (error) {
                console.error('ImageTracer error:', error);
                setPreviewSvg(null);
                setTracedata(null);
            } finally {
                setIsProcessing(false);
            }
        };

        img.onerror = () => {
            console.error("Failed to load image for tracing. It might be a CORS issue.");
            setIsProcessing(false);
            onClose();
        };
        
        img.src = imageObject.href;

    }, [isOpen, imageObject, params, preset, onClose]);

    if (!isOpen) return null;

    const handleApply = () => {
        if (tracedata) {
            onApply(tracedata);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl text-gray-200 flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Trace Image</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6 flex-grow flex gap-6 overflow-hidden">
                    <div className="w-2/3 bg-gray-900/50 rounded-lg p-4 border border-gray-700 bg-checkered flex items-center justify-center overflow-hidden">
                        {isProcessing && <div className="text-gray-400">Processing...</div>}
                        {!isProcessing && previewSvg && tracedata && (
                           <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: `<svg class="w-full h-full" viewBox="0 0 ${tracedata.width} ${tracedata.height}" preserveAspectRatio="xMidYMid meet">${previewSvg}</svg>` }} />
                        )}
                        {!isProcessing && !previewSvg && (
                            <div className="text-gray-500 text-center">
                                <p>No path generated.</p>
                                <p className="text-xs">Try adjusting the parameters.</p>
                            </div>
                        )}
                    </div>
                    <div className="w-1/3 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                        <SectionHeader title="Parameters" />
                        <ControlSelect
                            label="Preset"
                            value={preset}
                            onChange={handlePresetChange}
                        >
                            {Object.keys(OPTION_PRESETS).map(p => (
                                <option key={p} value={p}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </option>
                            ))}
                        </ControlSelect>
                        <div className="pt-2 space-y-3">
                            <ControlSlider 
                                label="Colors" 
                                value={params.numberofcolors} 
                                min={2} max={64} step={1} 
                                onChange={(val) => setParams(p => ({ ...p, numberofcolors: val }))} 
                            />
                             <ControlSlider 
                                label="Blur" 
                                value={params.blurradius} 
                                min={0} max={20} step={1} 
                                onChange={(val) => setParams(p => ({ ...p, blurradius: val }))} 
                            />
                            <ControlSlider 
                                label="Line Threshold" 
                                value={params.ltres} 
                                min={0.1} max={10} step={0.1} 
                                onChange={(val) => setParams(p => ({ ...p, ltres: val }))} 
                            />
                            <ControlSlider 
                                label="Curve Threshold" 
                                value={params.qtres} 
                                min={0.1} max={10} step={0.1} 
                                onChange={(val) => setParams(p => ({ ...p, qtres: val }))} 
                            />
                            <ControlSlider 
                                label="Filter Speckles" 
                                value={params.pathOmit} 
                                min={0} 
                                max={40} 
                                step={1} 
                                onChange={(val) => setParams(p => ({ ...p, pathOmit: val }))} 
                            />
                            <div className="flex items-center justify-between pt-2">
                                <label htmlFor="rightangle-enhance" className="text-xs font-medium text-gray-400 select-none">Enhance Right Angles</label>
                                <button 
                                    id="rightangle-enhance"
                                    onClick={() => setParams(p => ({...p, rightangleenhance: !p.rightangleenhance}))} 
                                    className={`${params.rightangleenhance ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-5 rounded-full w-9 transition-colors`}
                                >
                                    <span className={`${params.rightangleenhance ? 'translate-x-4' : 'translate-x-1'} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`} />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 italic pt-2">Lower threshold values result in more detail. The preview will update automatically.</p>
                    </div>
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                    <button onClick={handleApply} disabled={!previewSvg || isProcessing} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Apply Trace
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TraceImageModal;