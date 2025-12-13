
import React, { useState } from 'react';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportSVG: () => void;
    onExportPNG: () => void;
    onExportPDF: () => void;
    onExportDXF: () => void;
    pngExportScale: number;
    onPngExportScaleChange: (value: number) => void;
    filename: string;
    onFilenameChange: (value: string) => void;
}

/**
 * Modal for exporting the current canvas content.
 * Supports SVG, PNG, PDF, and DXF formats.
 * Provides options to set the filename, adjust the resolution scale for raster exports (PNG).
 */
const ExportModal: React.FC<ExportModalProps> = (props) => {
    const {
        isOpen, onClose, onExportSVG, onExportPNG, onExportPDF, onExportDXF,
        pngExportScale, onPngExportScaleChange,
        filename, onFilenameChange
    } = props;
    
    const [exportType, setExportType] = useState<'svg' | 'png' | 'pdf' | 'dxf'>('svg');

    if (!isOpen) return null;

    const handleExport = () => {
        switch (exportType) {
            case 'svg': onExportSVG(); break;
            case 'png': onExportPNG(); break;
            case 'pdf': onExportPDF(); break;
            case 'dxf': onExportDXF(); break;
        }
        onClose();
    };
    
    const exportButtonText = `Download ${exportType.toUpperCase()}`;
    const showAdvancedOptions = exportType === 'png';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Export Options</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Export Format</label>
                            <div className="grid grid-cols-4 gap-3">
                                { (['svg', 'png', 'pdf', 'dxf'] as const).map(type => (
                                    <button key={type} onClick={() => setExportType(type)}
                                        className={`w-full font-semibold py-2 rounded-lg transition-colors duration-200 ${exportType === type ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        {type.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="filename-modal" className="block text-sm font-medium text-gray-300 mb-1">Filename</label>
                            <input 
                                id="filename-modal" 
                                type="text" 
                                value={filename} 
                                onChange={(e) => onFilenameChange(e.target.value)} 
                                className="w-full bg-gray-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" 
                                placeholder="pattern"
                            />
                        </div>
                    </div>

                    {showAdvancedOptions && (
                        <div className="space-y-4 pt-4 border-t border-gray-700">
                            {exportType === 'png' && (
                                <div>
                                    <label htmlFor="png-scale-modal" className="block text-sm font-medium text-gray-300 mb-1">Resolution Scale</label>
                                    <input id="png-scale-modal" type="number" min="1" max="16" step="1" value={pngExportScale} onChange={(e) => onPngExportScaleChange(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-gray-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                            )}
                        </div>
                    )}
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                    <button onClick={handleExport} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">{exportButtonText}</button>
                </footer>
            </div>
        </div>
    );
};

export default ExportModal;
