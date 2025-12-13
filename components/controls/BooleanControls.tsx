
import React from 'react';
import { UnionIcon, SubtractIcon, IntersectIcon, ExcludeIcon, AttachToPathIcon, ConvertToPathIcon } from './Icons';
import { SectionHeader } from './CommonControls';

interface BooleanControlsProps {
    onBooleanOperation: (operation: 'unite' | 'subtract' | 'intersect' | 'exclude') => void;
    canOperateBoolean: boolean;
    onAttachToPath: () => void;
    isAttachToPathEnabled: boolean;
    onConvertObjectToPath: () => void;
    canConvertToPath: boolean;
}

/**
 * A helper button component for path operation actions.
 */
const PathOpButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }> = ({ onClick, title, children, disabled }) => (
    <button
        onClick={onClick}
        title={title}
        disabled={disabled}
        className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800 flex items-center justify-center aspect-square"
    >
        {children}
    </button>
);

/**
 * Controls for boolean path operations (Union, Subtract, Intersect, Exclude)
 * and other path-related transformations like Attach to Path and Convert to Path.
 */
export const BooleanControls: React.FC<BooleanControlsProps> = ({ 
    onBooleanOperation, 
    canOperateBoolean,
    onAttachToPath,
    isAttachToPathEnabled,
    onConvertObjectToPath,
    canConvertToPath
}) => {
    return (
        <div>
            <SectionHeader title="Path Operations" />
            <div className="grid grid-cols-6 gap-2 mt-1">
                <PathOpButton onClick={() => onBooleanOperation('unite')} title="Union" disabled={!canOperateBoolean}>
                    <UnionIcon className="w-4 h-4" />
                </PathOpButton>
                <PathOpButton onClick={() => onBooleanOperation('subtract')} title="Subtract (Back - Front)" disabled={!canOperateBoolean}>
                    <SubtractIcon className="w-4 h-4" />
                </PathOpButton>
                <PathOpButton onClick={() => onBooleanOperation('intersect')} title="Intersect" disabled={!canOperateBoolean}>
                    <IntersectIcon className="w-4 h-4" />
                </PathOpButton>
                <PathOpButton onClick={() => onBooleanOperation('exclude')} title="Exclude" disabled={!canOperateBoolean}>
                    <ExcludeIcon className="w-4 h-4" />
                </PathOpButton>
                
                <PathOpButton onClick={onAttachToPath} title="Attach to Path" disabled={!isAttachToPathEnabled}>
                    <AttachToPathIcon className="w-4 h-4" />
                </PathOpButton>
                
                <PathOpButton onClick={onConvertObjectToPath} title="Convert to Path" disabled={!canConvertToPath}>
                    <ConvertToPathIcon className="w-4 h-4" />
                </PathOpButton>
            </div>
        </div>
    );
};
