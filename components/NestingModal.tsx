
import React, { useState } from 'react';
import type { AppState, NestingResult } from '../types';
import { nestObjectsAsync } from '../workers/nesting-worker-client';

interface NestingModalProps {
    isOpen: boolean;
    onClose: () => void;
    appState: AppState;
    onApply: (result: NestingResult) => void;
}

/**
 * Modal dialog for configuring and running the nesting algorithm.
 * Allows setting padding and rotation preferences, then running the calculation.
 * Displays results and allows applying the new layout to the canvas.
 */
const NestingModal: React.FC<NestingModalProps> = ({ isOpen, onClose, appState, onApply }) => {
    const [padding, setPadding] = useState(5);
    const [rotations, setRotations] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<NestingResult | null>(null);

    if (!isOpen) return null;

    const handleStartNesting = async () => {
        setIsProcessing(true);
        try {
            const { layers, activeLayerId, canvasConfig } = appState;
            const layer = layers.find(l => l.id === activeLayerId);
            if (!layer || layer.objects.length === 0) {
                setIsProcessing(false);
                return;
            }

            // Nest all objects on the active layer using background worker
            const objectsToNest = layer.objects;

            const nestResult = await nestObjectsAsync(objectsToNest, {
                padding,
                canvasWidth: canvasConfig.width,
                canvasHeight: canvasConfig.height,
                iterations: 1,
                rotate: rotations
            });

            setResult(nestResult);
        } catch (err) {
            console.error('Nesting failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Nest Objects</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6 space-y-6">
                    {!result ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Padding (px)</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    value={padding} 
                                    onChange={(e) => setPadding(Math.max(0, parseInt(e.target.value) || 0))} 
                                    className="w-full bg-gray-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" 
                                />
                            </div>
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    id="nest-rotate" 
                                    checked={rotations} 
                                    onChange={(e) => setRotations(e.target.checked)} 
                                    className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500" 
                                />
                                <label htmlFor="nest-rotate" className="ml-2 font-medium text-gray-300 select-none">Allow Rotations (90°)</label>
                            </div>
                            <p className="text-xs text-gray-500 italic mt-2">
                                Note: Objects will be rearranged to fit tightly starting from the top-left. 
                                This process runs locally and may take a few seconds for many objects.
                            </p>
                        </>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto text-cyan-400 border border-cyan-500/50">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Nesting Complete</h3>
                                <p className="text-sm text-gray-400">
                                    Efficiency: {(result.fitness * 100).toFixed(1)}%<br/>
                                    Bounds: {Math.round(result.bounds.width)} x {Math.round(result.bounds.height)} px
                                </p>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                    {!result ? (
                        <button 
                            onClick={handleStartNesting} 
                            disabled={isProcessing}
                            className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isProcessing ? 'Processing...' : 'Start Nesting'}
                        </button>
                    ) : (
                        <button 
                            onClick={() => onApply(result)} 
                            className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
                        >
                            Apply Placement
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default NestingModal;
