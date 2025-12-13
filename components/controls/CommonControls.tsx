
import React from 'react';

interface ControlSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
}

/**
 * A reusable slider control component with a text input and optional unit display.
 * Used extensively for numeric properties like opacity, dimensions, and stroke width.
 */
export const ControlSlider: React.FC<ControlSliderProps> = ({ label, value, onChange, min, max, step = 1, unit, disabled }) => {
    return (
        <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-gray-400 select-none">{label}</label>
                <div className="flex items-center">
                    <input 
                        type="number" 
                        value={value}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="w-16 bg-transparent text-right text-xs font-mono text-cyan-400 focus:outline-none focus:text-cyan-300 hover:text-cyan-300 appearance-none border-b border-transparent focus:border-cyan-500 transition-colors"
                    />
                    {unit && <span className="text-[10px] text-gray-500 ml-1 select-none">{unit}</span>}
                </div>
            </div>
            <div className="h-4 flex items-center">
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    step={step} 
                    value={value} 
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all" 
                />
            </div>
        </div>
    );
};

interface SegmentedControlProps<T extends string> {
    options: { value: T; label: string | React.ReactNode; title?: string }[];
    value: T;
    onChange: (value: T) => void;
    label?: string;
}

/**
 * A segmented control (toggle buttons) for selecting one value from a set of mutually exclusive options.
 * Commonly used for alignment, text alignment, or boolean toggles presented as choices.
 */
export const SegmentedControl = <T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) => {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-xs font-medium text-gray-400 block select-none">{label}</label>}
            <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700">
                {options.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        title={option.title}
                        className={`flex-1 flex items-center justify-center py-1 text-xs font-medium rounded transition-all duration-200 ${
                            value === option.value 
                                ? 'bg-gray-600 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

interface ControlSelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}

/**
 * A styled select dropdown component.
 */
export const ControlSelect: React.FC<ControlSelectProps> = ({ label, value, onChange, children }) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-gray-400 select-none">{label}</label>
        <div className="relative">
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-1.5 pl-2 pr-8 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 appearance-none transition-shadow"
            >
                {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
    </div>
);

/**
 * A section header used to divide groups of controls.
 */
export const SectionHeader: React.FC<{ title: string, children?: React.ReactNode }> = ({ title, children }) => (
    <div className="flex items-center justify-between py-2">
        <div className="flex items-center flex-grow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</span>
            <div className="flex-grow h-px bg-gray-800 ml-2"></div>
        </div>
        {children && <div className="ml-2 flex-shrink-0">{children}</div>}
    </div>
);
