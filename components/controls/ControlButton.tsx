
import React from 'react';

/**
 * A styled button component for control panels.
 * Supports an 'active' state for toggle functionality.
 *
 * @param props.onClick - Callback for click events.
 * @param props.active - Boolean indicating if the button is currently active/selected.
 * @param props.children - The content of the button (usually an icon).
 * @param props.title - Optional tooltip text.
 */
const ControlButton: React.FC<{ onClick: () => void; active: boolean; children: React.ReactNode, title?: string }> = ({ onClick, active, children, title }) => (
    <button 
        onClick={onClick} 
        title={title} 
        className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-all duration-200 border ${ active ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200' }`}
    >
        {children}
    </button>
);

export default ControlButton;
