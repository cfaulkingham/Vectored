
import React from 'react';
import type { MirrorMode } from '../../types';
import { NoneIcon, MirrorHorizontalIcon, MirrorVerticalIcon } from './Icons';
import { ControlSlider } from './CommonControls';

interface SymmetryControlsProps {
    mirrorMode: MirrorMode;
    onMirrorModeChange: (mode: MirrorMode) => void;
    mirrorGap: number;
    onMirrorGapChange: (gap: number) => void;
}

/**
 * Controls for setting up drawing symmetry.
 * Allows selecting horizontal or vertical mirroring and adjusting the gap between the mirror axis.
 */
const SymmetryControls: React.FC<SymmetryControlsProps> = ({ mirrorMode, onMirrorModeChange, mirrorGap, onMirrorGapChange }) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Mode</label>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => onMirrorModeChange('off')} 
                        className={`p-2 rounded-md flex flex-col items-center justify-center transition-all duration-200 ${mirrorMode === 'off' ? 'bg-gray-600 text-white shadow-sm' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        title="No Symmetry"
                    >
                        <NoneIcon className="w-5 h-5 mb-1" />
                        <span className="text-[10px]">Off</span>
                    </button>
                    <button 
                        onClick={() => onMirrorModeChange('horizontal')} 
                        className={`p-2 rounded-md flex flex-col items-center justify-center transition-all duration-200 ${mirrorMode === 'horizontal' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        title="Horizontal Mirror"
                    >
                        <MirrorHorizontalIcon className="w-5 h-5 mb-1" />
                        <span className="text-[10px]">Horiz</span>
                    </button>
                    <button 
                        onClick={() => onMirrorModeChange('vertical')} 
                        className={`p-2 rounded-md flex flex-col items-center justify-center transition-all duration-200 ${mirrorMode === 'vertical' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        title="Vertical Mirror"
                    >
                        <MirrorVerticalIcon className="w-5 h-5 mb-1" />
                        <span className="text-[10px]">Vert</span>
                    </button>
                </div>
            </div>
            {mirrorMode !== 'off' && (
                <ControlSlider label="Gap" value={mirrorGap} min={0} max={200} step={2} unit="px" onChange={onMirrorGapChange} />
            )}
        </div>
    );
};

export default SymmetryControls;
