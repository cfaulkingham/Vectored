
import React, { useState, useEffect } from 'react';
import type { Layer } from '../types';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (layerId: string, scaleMode: 'original' | 'fit') => void;
    layers: Layer[];
    initialLayerId: string | null;
    type: 'svg' | 'image';
}

/**
 * Modal for importing external assets (SVG or Image).
 * Allows the user to select a target layer and choose between original size or fitting to canvas.
 */
const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onConfirm, layers, initialLayerId, type }) => {
    const [selectedLayerId, setSelectedLayerId] = useState<string>(initialLayerId || (layers[0]?.id ?? ''));
    const [scaleMode, setScaleMode] = useState<'original' | 'fit'>('original');

    useEffect(() => {
        if (isOpen) {
            setSelectedLayerId(initialLayerId || (layers[0]?.id ?? ''));
            setScaleMode('original');
        }
    }, [isOpen, initialLayerId, layers]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedLayerId) {
            onConfirm(selectedLayerId, scaleMode);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Import {type === 'svg' ? 'SVG' : 'Image'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Target Layer</label>
                        <select 
                            value={selectedLayerId} 
                            onChange={(e) => setSelectedLayerId(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        >
                            {layers.map(layer => (
                                <option key={layer.id} value={layer.id}>{layer.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Sizing</label>
                        <div className="space-y-3">
                            <div className="flex items-center">
                                <input 
                                    id="scale-original" 
                                    type="radio" 
                                    name="scale-mode" 
                                    checked={scaleMode === 'original'} 
                                    onChange={() => setScaleMode('original')}
                                    className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500 focus:ring-2"
                                />
                                <label htmlFor="scale-original" className="ml-2 text-sm font-medium text-gray-300">
                                    Original Size (1:1)
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input 
                                    id="scale-fit" 
                                    type="radio" 
                                    name="scale-mode" 
                                    checked={scaleMode === 'fit'} 
                                    onChange={() => setScaleMode('fit')}
                                    className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500 focus:ring-2"
                                />
                                <label htmlFor="scale-fit" className="ml-2 text-sm font-medium text-gray-300">
                                    Fit to Canvas
                                </label>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                    <button onClick={handleConfirm} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">Import</button>
                </footer>
            </div>
        </div>
    );
};

export default ImportModal;
