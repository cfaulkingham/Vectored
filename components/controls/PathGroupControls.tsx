
import React from 'react';
import type { PathGroupObject, PathGroupSettings } from '../../types';
import { ControlSlider, SegmentedControl, SectionHeader } from './CommonControls';

interface PathGroupControlsProps {
    object: PathGroupObject;
    onUpdateSelectedObjects: (props: Partial<PathGroupObject>) => void;
    onApply: () => void;
}

/**
 * Controls for configuring Path Groups (distributing objects along a path).
 * Allows adjusting count, distance, offset, alignment, and rotation settings.
 * Also provides the action to "Apply & Ungroup", which bakes the distribution into individual objects.
 */
const PathGroupControls: React.FC<PathGroupControlsProps> = ({ object, onUpdateSelectedObjects, onApply }) => {
    const { settings } = object;

    const handleSettingsChange = (newSettings: Partial<PathGroupSettings>) => {
        onUpdateSelectedObjects({ settings: { ...settings, ...newSettings } });
    };

    return (
        <div className="space-y-4">
            <div>
                <SectionHeader title="Distribution" />
                <div className="mt-2 space-y-3">
                    <SegmentedControl 
                        options={[{ value: 'count', label: 'Count' }, { value: 'distance', label: 'Distance' }]}
                        value={settings.distributionMode}
                        onChange={(val) => handleSettingsChange({ distributionMode: val as any })}
                    />

                    {settings.distributionMode === 'count' ? (
                        <ControlSlider label="Count" value={settings.count} min={1} max={500} onChange={(val) => handleSettingsChange({ count: val })} />
                    ) : (
                        <ControlSlider label="Distance" value={settings.distance} min={1} max={500} unit="px" onChange={(val) => handleSettingsChange({ distance: val })} />
                    )}
                </div>
            </div>

            <div>
                <SectionHeader title="Placement" />
                <div className="mt-2 space-y-3">
                    <ControlSlider label="Start Offset" value={settings.startOffset} min={0} max={1} step={0.01} onChange={(val) => handleSettingsChange({ startOffset: val })} />
                    <ControlSlider label="End Offset" value={settings.endOffset} min={0} max={1} step={0.01} onChange={(val) => handleSettingsChange({ endOffset: val })} />
                </div>
            </div>

            <div>
                <SectionHeader title="Alignment" />
                <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-400 select-none">Align to Path</label>
                        <button onClick={() => handleSettingsChange({ alignToPath: !settings.alignToPath })} className={`${settings.alignToPath ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-5 rounded-full w-9 transition-colors`}>
                            <span className={`${settings.alignToPath ? 'translate-x-4' : 'translate-x-1'} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`} />
                        </button>
                    </div>
                    <ControlSlider label="Path Offset" value={settings.perpendicularOffset || 0} min={-100} max={100} unit="px" onChange={(val) => handleSettingsChange({ perpendicularOffset: val })} />
                    <ControlSlider label="Rotation Offset" value={settings.rotationOffset || 0} min={-180} max={180} unit="°" onChange={(val) => handleSettingsChange({ rotationOffset: val })} />
                </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
                <button
                    onClick={onApply}
                    className="w-full bg-cyan-600 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-md hover:bg-cyan-500 transition-colors shadow-md"
                >
                    Apply &amp; Ungroup
                </button>
            </div>
        </div>
    );
};

export default PathGroupControls;
