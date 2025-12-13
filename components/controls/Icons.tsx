
import React from 'react';

/**
 * A set of SVG icon components used throughout the UI.
 * These are functional components accepting an optional `className` prop for styling.
 */

export const RectangleIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" /></svg>;
export const CircleIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>;

export const DrawIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>;

export const SelectIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5 9 2 12 5 15"></polyline>
        <polyline points="9 5 12 2 15 5"></polyline>
        <polyline points="15 19 12 22 9 19"></polyline>
        <polyline points="19 9 22 12 19 15"></polyline>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="12" y1="2" x2="12" y2="22"></line>
    </svg>
);
export const NodeToolIcon: React.FC<{ className?: string }> = ({ className }) => (
<svg 
  className={className} 
  viewBox="0 0 24 24" 
  fill="currentColor" // Changed from "none"
  stroke="currentColor" 
  strokeWidth="2" 
  strokeLinecap="round" 
  strokeLinejoin="round"
  fillRule="evenodd" // Added this to make the circle a hole
>
    <path d="M3 3l7.5 18.5 2.5-8 8-2.5L3 3z" />
    <circle cx="13" cy="13" r="2" />
</svg>
);
export const PolygonIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <line x1="7.5" y1="7.5" x2="10.5" y2="16.5" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="16.5" y1="7.5" x2="13.5" y2="16.5" />
    </svg>
);
export const TextIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7"></polyline>
        <line x1="9" y1="20" x2="15" y2="20"></line>
        <line x1="12" y1="4" x2="12" y2="20"></line>
    </svg>
);

export const FreehandIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="M15 5l4 4" />
    </svg>
);

export const PatternBrushIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="4" cy="11" r="1" fill="currentColor" />
        <circle cx="9" cy="3" r="1" fill="currentColor" />
    </svg>
);

export const LineIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="19" y2="5"></line>
    </svg>
);

export const ShapeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
);
export const StampIcon = ShapeIcon; // Deprecated, mapped to ShapeIcon

export const ImageIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>;

export const VoronoiIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 L2 7 L2 17 L12 22 L22 17 L22 7 Z" />
        <path d="M2 7 L12 12" />
        <path d="M12 22 V 12" />
        <path d="M22 7 L12 12" />
        <path d="M17 4.5 L7 9.5" />
    </svg>
);

export const CirclesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="16" r="5" />
        <circle cx="17" cy="7" r="2" />
    </svg>
);

export const HalftoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="6" cy="6" r="2"/>
        <circle cx="12" cy="6" r="3"/>
        <circle cx="18" cy="6" r="1.5"/>
        <circle cx="6" cy="12" r="3.5"/>
        <circle cx="12" cy="12" r="1.5"/>
        <circle cx="18" cy="12" r="3"/>
        <circle cx="6" cy="18" r="1"/>
        <circle cx="12" cy="18" r="4"/>
        <circle cx="18" cy="18" r="2.5"/>
    </svg>
);

export const SineIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
    </svg>
);

export const StippleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="4" cy="4" r="1.5"/><circle cx="10" cy="5" r="1"/><circle cx="14" cy="4" r="0.8"/><circle cx="20" cy="5" r="1.2"/><circle cx="6" cy="10" r="1.8"/><circle cx="12" cy="11" r="2.2"/><circle cx="18" cy="9" r="1.4"/><circle cx="5" cy="16" r="1.1"/><circle cx="11" cy="18" r="2.5"/><circle cx="19" cy="17" r="1.9"/><circle cx="15" cy="14" r="0.9"/>
    </svg>
);

export const WordsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V5h16v2"/>
        <path d="M12 5v14"/>
        <path d="M8 21h8"/>
        <path d="M6 13h1"/>
        <path d="M17 13h1"/>
    </svg>
);

export const TopoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 19a4 4 0 100-8 4 4 0 000 8z" />
        <path d="M15 12a6 6 0 10-6 5.65" />
        <path d="M12 21a9 9 0 10-9-9" />
    </svg>
);

export const ReactionDiffusionIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 15.5c-2.3-2.3-2.3-6.1 0-8.5 2.3-2.3 6.1-2.3 8.5 0"/>
        <path d="M15.5 11c-2.3-2.3-2.3-6.1 0-8.5C17.8.2 21.7.2 24 2.5"/>
        <path d="M8.5 11c-2.3-2.3-2.3-6.1 0-8.5C10.8.2 14.7.2 17 2.5"/>
        <path d="M11 8.5c2.3 2.3 2.3 6.1 0 8.5C8.7 19.3 4.8 19.3 2.5 17"/>
        <path d="M4.5 17c2.3 2.3 6.1 2.3 8.5 0"/>
    </svg>
);

export const LSystemIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V10"/>
        <path d="M12 10L7 5"/>
        <path d="M12 10L17 5"/>
        <path d="M7 5L4 2"/>
        <path d="M7 5L10 2"/>
        <path d="M17 5L14 2"/>
        <path d="M17 5L20 2"/>
    </svg>
);

export const ColonizationIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V12"/>
        <path d="M12 12L8 8"/>
        <path d="M12 12L16 8"/>
        <path d="M8 8L5 5"/>
        <path d="M8 8L11 5"/>
        <path d="M16 8L13 5"/>
        <path d="M16 8L19 5"/>
    </svg>
);

export const CrosshatchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="4" x2="20" y2="20" />
        <line x1="8" y1="4" x2="20" y2="16" />
        <line x1="4" y1="8" x2="16" y2="20" />
        <line x1="12" y1="4" x2="20" y2="12" />
        <line x1="4" y1="12" x2="12" y2="20" />
        <line x1="16" y1="4" x2="20" y2="8" />
        <line x1="4" y1="16" x2="8" y2="20" />
        <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
);

export const HatchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 3.5 L17.5 3.5 L21 10 L17.5 16.5 L6.5 16.5 L3 10 Z" />
        <path d="M6 14 L13 7" />
        <path d="M8.5 16.5 L18 7" />
        <path d="M12.5 16.5 L21 8" />
        <path d="M17.5 16.5 L21 13" />
    </svg>
);

export const GlitchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8h16v8H4z" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
        <path d="M8 4v4" />
        <path d="M16 16v4" />
    </svg>
);

export const RoseCurveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" opacity="0.3" />
        <path d="M12 4 A8 8 0 0 1 18.928 6.072 A8 8 0 0 1 17.535 15.535 A8 8 0 0 1 6.464 17.535 A8 8 0 0 1 5.071 6.072 A8 8 0 0 1 12 4 Z" />
        <path d="M12 4 L12 12 L12 20" opacity="0.0" />
    </svg>
);

export const FlowFieldIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6 Q 6 2, 12 6 T 22 6" />
        <path d="M2 12 Q 6 8, 12 12 T 22 12" />
        <path d="M2 18 Q 6 14, 12 18 T 22 18" />
    </svg>
);

export const TruchetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12c0 4.418 3.582 8 8 8s8-3.582 8-8V4C16 4 12 4 12 4s-8 0-8 8z" />
        <path d="M12 4c0 4.418 3.582 8 8 8" opacity="0.5"/>
    </svg>
);

export const SpirographIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.46 19.46a10.5 10.5 0 11-14.92-14.92 10.5 10.5 0 0114.92 14.92zm-3.09-3.09a6.5 6.5 0 10-9.22-9.22 6.5 6.5 0 009.22 9.22z"/>
    </svg>
);

export const GuillocheIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.83 5.17a9 9 0 00-13.66 0m13.66 13.66a9 9 0 01-13.66 0M5.17 5.17a9 9 0 0113.66 0M5.17 18.83a9 9 0 0013.66 0"/>
    </svg>
);

export const GearIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeDasharray="2 2"/>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
);

export const PuzzleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2h4a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 0 1-1V3a1 1 0 0 1 1-1z" />
    </svg>
);

export const MazeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4V4zm4 4v4h4v-4H8zm0 8h4v-4h-4v4zm8-4v4h-4v-4h4zm0-4h-4v4h4V8z" />
        <path d="M4 8h4M12 8h4M20 16h-4M12 16H8" />
    </svg>
);

export const NoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
);

export const AttachToPathIcon: React.FC<{ className?: string }> = ({ className }) => (
<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Curved path */}
    <path d="M3 15c3-6 6-8 9-8s6 2 9 8" strokeWidth="2" />
    
    {/* Attachment points with connecting lines */}
    <line x1="6" y1="10.5" x2="6" y2="8" strokeWidth="1.5" />
    <circle cx="6" cy="10.5" r="1.5" fill="currentColor" />
    
    <line x1="12" y1="7" x2="12" y2="4" strokeWidth="1.5" />
    <rect x="10.5" y="2.5" width="3" height="3" rx="0.5" fill="currentColor" />
    
    <line x1="18" y1="10.5" x2="18" y2="8" strokeWidth="1.5" />
    <path d="M18 6l2 2-2 2-2-2z" fill="currentColor" />
</svg>
);

export const ConvertToPathIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16C8 8, 16 8, 20 16" />
        <rect x="3" y="15" width="2" height="2" fill="currentColor" />
        <rect x="19" y="15" width="2" height="2" fill="currentColor" />
    </svg>
);

export const NestIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h6v6H4z" />
        <path d="M14 4h6v6h-6z" />
        <path d="M4 14h6v6H4z" />
        <path d="M14 14h6v6h-6z" />
        <path d="M10 10l4 4" strokeDasharray="2 2" />
        <path d="M10 14l4-4" strokeDasharray="2 2" />
    </svg>
);

export const UndoIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>;
export const RedoIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>;
export const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
export const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.303 6.546A10.048 10.048 0 00.458 10c1.274 4.057 5.022 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>;
export const EyedropperIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2.3 21.7 1.4-1.4c.5-.5.5-1.3 0-1.8L5.1 17a1.3 1.3 0 0 1 1.8 0l1.4 1.4c.5.5.5 1.3 0 1.8L6.9 21.7a1.3 1.3 0 0 1-1.8 0L2.3 18.9a1.3 1.3 0 0 1 0-1.8Z"/>
        <path d="m14 4 3 3"/>
        <path d="M9.5 12.5 16 6l3 3-6.5 6.5"/>
    </svg>
);
export const MirrorHorizontalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20" strokeDasharray="2 2" />
        <path d="M4 16V8l4 4-4 4z" />
        <path d="M20 16V8l-4 4 4 4z" />
    </svg>
);
export const MirrorVerticalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h20" strokeDasharray="2 2" />
        <path d="M8 4h8l-4 4-4-4z" />
        <path d="M8 20h8l-4-4-4 4z" />
    </svg>
);

export const MeasureIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 17h20M2 7h20M2 7v10M22 7v10M7 7v3M12 7v3M17 7v3" />
    </svg>
);

// New Icons
export const SaveIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
export const LoadIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
export const ExportIcon = ({ className }: { className?: string }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"/><path d="M12 18v-6m-3 3l3-3 3 3"/></svg>;
export const PrintIcon = ({ className }: { className?: string }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>;
export const ImportIcon = ({ className }: { className?: string }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7"></path><polyline points="17 12 12 7 7 12"></polyline><line x1="12" y1="7" x2="12" y2="21"></line></svg>;
export const PlusIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
export const DuplicateIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
export const TrashIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
export const DownIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
export const UpIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>;
export const ClipIcon = ({ className }: { className?: string }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14L21 3"></path><path d="M21 14L14 21L3 10L10 3L21 14Z"></path></svg>;
export const LayersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
    </svg>
);
export const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);
export const UnlockIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 8-4h1a2 2 0 0 1 2 2v4"></path></svg>;
export const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);
export const SendBackwardIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="10" height="10" rx="2" ry="2"></rect><path d="M7 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3"></path></svg>;
export const BringForwardIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="14" width="8" height="8" rx="2" ry="2"></rect><path d="M10 10l-6 6V4a2 2 0 0 1 2-2h8z"></path></svg>;
export const SendToBackIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="10" height="10" rx="2" ry="2"></rect><rect x="7" y="7" width="10" height="10" rx="2" ry="2"></rect><rect x="13" y="13" width="10" height="10" rx="2" ry="2"></rect></svg>;
export const BringToFrontIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="13" y="13" width="10" height="10" rx="2" ry="2"></rect><rect x="7" y="7" width="10" height="10" rx="2" ry="2"></rect><rect x="1" y="1" width="10" height="10" rx="2" ry="2"></rect></svg>;
export const NewFileIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>;
export const FileIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
);

// Alignment Icons
export const AlignLeftIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 22H2V2h2v20Z M22 7H6v3h16V7Z M14 14H6v3h8v-3Z"/></svg>;
export const AlignCenterHIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 22h-2V2h2v20Z M22 7H2v3h20V7Z M18 14H6v3h12v-3Z"/></svg>;
export const AlignRightIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 22h-2V2h2v20Z M2 7h16v3H2V7Z M10 14h8v3h-8v-3Z"/></svg>;
export const AlignTopIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 4V2H2v2h20Z M7 22V6h3v16H7Z M14 14V6h3v8h-3Z"/></svg>;
export const AlignCenterVIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 13v-2H2v2h20Z M7 22V2h3v20H7Z M14 18V6h3v12h-3Z"/></svg>;
export const AlignBottomIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 22v-2H2v2h20Z M7 2v16h3V2H7Z M14 10v8h3v-8h-3Z"/></svg>;
export const DistributeHIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="2" height="20" /><rect x="20" y="2" width="2" height="20" /><rect x="9" y="7" width="6" height="10" /></svg>;
export const DistributeVIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="2" /><rect x="2" y="20" width="20" height="2" /><rect x="7" y="9" width="10" height="6" /></svg>;
export const FlipHorizontalIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" strokeDasharray="2 2"/><path d="M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z"/></svg>;
export const FlipVerticalIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20" strokeDasharray="2 2"/><path d="M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z"/></svg>;

// Boolean Operation Icons (Pathfinder style)
export const UnionIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5 h10 v10 h-10 z" fill="currentColor" stroke="none" />
        <path d="M12 12 h10 v10 h-10 z" fill="currentColor" stroke="none" />
    </svg>
);
export const SubtractIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5 h10 v10 h-10 z" fill="currentColor" stroke="none" />
        <path d="M12 12 h10 v10 h-10 z" fill="#1f2937" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);
export const IntersectIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5 h12 v12 h-12 z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 9 h12 v12 h-12 z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 9 h8 v8 h-8 z" fill="currentColor" stroke="none" />
    </svg>
);
export const ExcludeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5 h12 v12 h-12 z" fill="currentColor" stroke="none" />
        <path d="M9 9 h12 v12 h-12 z" fill="currentColor" stroke="none" />
        <path d="M9 9 h8 v8 h-8 z" fill="#1f2937" stroke="none" />
    </svg>
);

export const LivingHingeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h4 M12 6h4 M20 6h-2" />
        <path d="M2 12h2 M8 12h4 M16 12h4" />
        <path d="M4 18h4 M12 18h4 M20 18h-2" />
    </svg>
);

export const SettingsIcon = ({ className }: { className?: string }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;

export const HelpIcon = ({ className }: { className?: string }) => <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

export const SnapIcon = ({ className }: { className?: string }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
);

export const LayoutIcon = ({ className }: { className?: string }) => (
    <svg className={className || "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <rect x="8" y="8" width="8" height="8" fill="currentColor" strokeWidth="0" />
        <line x1="12" y1="3" x2="12" y2="8" strokeDasharray="1.5 1.5" strokeWidth="1" />
        <line x1="12" y1="16" x2="12" y2="21" strokeDasharray="1.5 1.5" strokeWidth="1" />
    </svg>
);
