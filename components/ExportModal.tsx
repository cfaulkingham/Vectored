
import React, { useState } from 'react';
import { showFileError } from '../lib/file-io';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportSVG: () => Promise<boolean>;
    onExportPNG: () => Promise<boolean>;
    onExportPDF: () => Promise<boolean>;
    onExportDXF: () => Promise<boolean>;
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
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let saved = false;
            switch (exportType) {
                case 'svg': saved = await onExportSVG(); break;
                case 'png': saved = await onExportPNG(); break;
                case 'pdf': saved = await onExportPDF(); break;
                case 'dxf': saved = await onExportDXF(); break;
            }
            if (saved) onClose();
        } catch (error) {
            await showFileError('Could not export the file.', error);
        } finally {
            setIsExporting(false);
        }
    };
    
    const exportButtonText = isExporting ? 'Saving...' : `Save ${exportType.toUpperCase()}`;
    const showAdvancedOptions = exportType === 'png';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={isExporting ? undefined : onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Export Options</h2>
                    <button onClick={onClose} disabled={isExporting} className="text-gray-400 hover:text-white transition-colors text-2xl disabled:opacity-50">&times;</button>
                </header>
                
                <main className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Export Format</label>
                            <div className="grid grid-cols-4 gap-3">
                                { (['svg', 'png', 'pdf', 'dxf'] as const).map(type => (
                                    <button key={type} onClick={() => setExportType(type)}
                                        disabled={isExporting}
                                        className={`w-full font-semibold py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 ${exportType === type ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
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
                                disabled={isExporting}
                                className="w-full bg-gray-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50" 
                                placeholder="pattern"
                            />
                        </div>
                    </div>

                    {showAdvancedOptions && (
                        <div className="space-y-4 pt-4 border-t border-gray-700">
                            {exportType === 'png' && (
                                <div>
                                    <label htmlFor="png-scale-modal" className="block text-sm font-medium text-gray-300 mb-1">Resolution Scale</label>
                                    <input id="png-scale-modal" type="number" min="1" max="16" step="1" value={pngExportScale} onChange={(e) => onPngExportScaleChange(Math.max(1, Number(e.target.value) || 1))} disabled={isExporting} className="w-full bg-gray-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50" />
                                </div>
                            )}
                        </div>
                    )}
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} disabled={isExporting} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors disabled:opacity-50">Cancel</button>
                    <button onClick={handleExport} disabled={isExporting} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors disabled:opacity-50 flex items-center space-x-2">
                        {isExporting && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        <span>{exportButtonText}</span>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ExportModal;
