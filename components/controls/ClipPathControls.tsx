import React from 'react';
import type { Layer } from '../../types';

interface ClipPathControlsProps {
    activeLayer: Layer;
    onUpdateActiveLayer: (updater: (layer: Layer) => void) => void;
    onClearClipPath: () => void;
    setEditingMode: React.Dispatch<React.SetStateAction<'shape' | 'clip' | 'layer'>>;
}

/**
 * Controls for managing layer clipping paths.
 * Allows toggling clipping on/off, inverting the clip mode, and clearing the clip path.
 */
const ClipPathControls: React.FC<ClipPathControlsProps> = ({ activeLayer, onUpdateActiveLayer, onClearClipPath, setEditingMode }) => {

    return (
        <div className="space-y-4">
             <div className="p-3 bg-gray-900/50 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                    <label htmlFor="use-clipping" className="font-medium text-gray-300 select-none">Enable Clipping</label>
                    <button onClick={() => onUpdateActiveLayer(l => {l.useClipping = !l.useClipping})} className={`${activeLayer.useClipping ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}>
                        <span className={`${activeLayer.useClipping ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="invert-clip" className="font-medium text-gray-300 select-none">Invert Path</label>
                     <button onClick={() => onUpdateActiveLayer(l => {l.clipMode = l.clipMode === 'normal' ? 'inverted' : 'normal'})} className={`${activeLayer.clipMode === 'inverted' ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}>
                        <span className={`${activeLayer.clipMode === 'inverted' ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                    </button>
                </div>
                <button onClick={onClearClipPath} className="w-full bg-gray-700 text-gray-300 font-semibold py-2 rounded-lg transition-colors duration-200 hover:bg-gray-600">Clear Clip Path</button>
             </div>
        </div>
    );
};

export default ClipPathControls;
