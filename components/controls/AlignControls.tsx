
import React, { useState } from 'react';
import type { AlignmentType } from '../../types';
import {
    AlignLeftIcon, AlignCenterHIcon, AlignRightIcon,
    AlignTopIcon, AlignCenterVIcon, AlignBottomIcon,
    DistributeHIcon, DistributeVIcon,
    SendToBackIcon, SendBackwardIcon, BringForwardIcon, BringToFrontIcon,
    FlipHorizontalIcon, FlipVerticalIcon
} from './Icons';
import { SectionHeader } from './CommonControls';

interface AlignControlsProps {
    onAlign: (alignment: AlignmentType) => void;
    onAlignToCanvas: (alignment: AlignmentType) => void;
    onReorderObject: (direction: 'forward' | 'backward' | 'front' | 'back') => void;
    onFlip: (direction: 'horizontal' | 'vertical') => void;
    selectionCount: number;
    isSingleSelection: boolean;
    isAtBack: boolean;
    isAtFront: boolean;
    onGroup: () => void;
    onUngroup: () => void;
    canGroup: boolean;
    canUngroup: boolean;
}

/**
 * A helper button component for alignment actions.
 */
const AlignButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }> = ({ onClick, title, children, disabled }) => (
    <button
        onClick={onClick}
        title={title}
        disabled={disabled}
        className="p-1.5 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800 flex items-center justify-center aspect-square"
    >
        {children}
    </button>
);

/**
 * Controls for aligning, distributing, ordering, grouping, and transforming selected objects.
 * Includes alignment to selection bounds, z-ordering, flipping, and grouping.
 */
export const AlignControls: React.FC<AlignControlsProps> = ({ onAlign, onReorderObject, onFlip, selectionCount, isSingleSelection, isAtBack, isAtFront, onGroup, onUngroup, canGroup, canUngroup }) => {
    const canAlignObjects = selectionCount >= 2;
    const canDistributeObjects = selectionCount >= 3;
    
    return (
        <div className="space-y-3">
            <div>
                <SectionHeader title="Arrangement" />
                <div className="grid grid-cols-6 gap-1 mt-1">
                    <AlignButton onClick={onGroup} title="Group" disabled={!canGroup}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></AlignButton>
                    <AlignButton onClick={onUngroup} title="Ungroup" disabled={!canUngroup}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" strokeDasharray="2 2"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></AlignButton>
                    <AlignButton onClick={() => onFlip('horizontal')} title="Flip Horizontal" disabled={selectionCount === 0}><FlipHorizontalIcon className="w-4 h-4" /></AlignButton>
                    <AlignButton onClick={() => onFlip('vertical')} title="Flip Vertical" disabled={selectionCount === 0}><FlipVerticalIcon className="w-4 h-4" /></AlignButton>
                    
                    <AlignButton onClick={() => onReorderObject('back')} title="Send to Back" disabled={selectionCount === 0 || (isSingleSelection && isAtBack)}><SendToBackIcon className="w-4 h-4" /></AlignButton>
                    <AlignButton onClick={() => onReorderObject('backward')} title="Send Backward" disabled={!isSingleSelection || isAtBack}><SendBackwardIcon className="w-4 h-4" /></AlignButton>
                    <AlignButton onClick={() => onReorderObject('forward')} title="Bring Forward" disabled={!isSingleSelection || isAtFront}><BringForwardIcon className="w-4 h-4" /></AlignButton>
                    <AlignButton onClick={() => onReorderObject('front')} title="Bring to Front" disabled={selectionCount === 0 || (isSingleSelection && isAtFront)}><BringToFrontIcon className="w-4 h-4" /></AlignButton>
                </div>
            </div>

            <div>
                <SectionHeader title="Alignment" />
                <div className="grid grid-cols-6 gap-1 mt-1">
                    <AlignButton onClick={() => onAlign('align-left')} title="Align Left" disabled={!canAlignObjects}><AlignLeftIcon /></AlignButton>
                    <AlignButton onClick={() => onAlign('align-center-h')} title="Align Horizontal Center" disabled={!canAlignObjects}><AlignCenterHIcon /></AlignButton>
                    <AlignButton onClick={() => onAlign('align-right')} title="Align Right" disabled={!canAlignObjects}><AlignRightIcon /></AlignButton>
                    <AlignButton onClick={() => onAlign('align-top')} title="Align Top" disabled={!canAlignObjects}><AlignTopIcon /></AlignButton>
                    <AlignButton onClick={() => onAlign('align-center-v')} title="Align Vertical Center" disabled={!canAlignObjects}><AlignCenterVIcon /></AlignButton>
                    <AlignButton onClick={() => onAlign('align-bottom')} title="Align Bottom" disabled={!canAlignObjects}><AlignBottomIcon /></AlignButton>
                    
                    <AlignButton onClick={() => onAlign('distribute-h')} title="Distribute Horizontally" disabled={!canDistributeObjects}><DistributeHIcon /></AlignButton>
                    <AlignButton onClick={() => onAlign('distribute-v')} title="Distribute Vertically" disabled={!canDistributeObjects}><DistributeVIcon /></AlignButton>
                </div>
            </div>
        </div>
    );
};

export default AlignControls;
