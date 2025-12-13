import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from '../context/EditorContext';
import { 
    ExportIcon, ImportIcon, PrintIcon, SettingsIcon, HelpIcon, SnapIcon, LayoutIcon,
    AlignLeftIcon, AlignCenterHIcon, AlignRightIcon, AlignTopIcon, AlignCenterVIcon, AlignBottomIcon, NestIcon
} from './controls/Icons';

// Minimal icons for zoom
const ZoomInIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>;
const ZoomOutIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>;
const FitScreenIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>;
const FitCanvasIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 8 22 12 18 16" /><polyline points="6 8 2 12 6 16" /><line x1="2" y1="12" x2="22" y2="12" /></svg>;

/**
 * The top navigation bar of the application.
 * Contains primary actions like New, Open, Save, Import, and Export.
 * Also houses View controls (Zoom, Fit to Screen) and global Canvas Settings (Snapping, Dimensions, Layout).
 * Handles dynamic zooming and responsive layout adjustments.
 */
const TopBar: React.FC = () => {
    const {
        projectManager,
        viewState, setViewState, canvasConfig,
        handleInitiateImport,
        snapSettings, setSnapSettings,
        handleAlignToCanvas,
        selectedObjects,
        activeLayerHasObjects,
        units,
        dpi,
        handleCanvasConfigChange
    } = useEditor();

    const { 
        handleNewProject, handleSaveProjectFile, handleFileSelectedForLoad, 
        setIsExportModalOpen, setIsCanvasSettingsModalOpen, setIsHelpModalOpen,
        setIsNestingModalOpen, handlePrint
    } = projectManager;
    
    const loadInputRef = useRef<HTMLInputElement>(null);
    const importSvgRef = useRef<HTMLInputElement>(null);
    
    const snapMenuRef = useRef<HTMLDivElement>(null);
    const snapButtonRef = useRef<HTMLButtonElement>(null);
    
    const layoutMenuRef = useRef<HTMLDivElement>(null);
    const layoutButtonRef = useRef<HTMLButtonElement>(null);
    
    const [isSnapMenuOpen, setIsSnapMenuOpen] = useState(false);
    const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isSnapMenuOpen &&
                snapMenuRef.current &&
                !snapMenuRef.current.contains(event.target as Node) &&
                snapButtonRef.current &&
                !snapButtonRef.current.contains(event.target as Node)
            ) {
                setIsSnapMenuOpen(false);
            }
            if (
                isLayoutMenuOpen &&
                layoutMenuRef.current &&
                !layoutMenuRef.current.contains(event.target as Node) &&
                layoutButtonRef.current &&
                !layoutButtonRef.current.contains(event.target as Node)
            ) {
                setIsLayoutMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSnapMenuOpen, isLayoutMenuOpen]);

    const handleZoomIn = () => setViewState(prev => ({ ...prev, zoom: Math.min(50, prev.zoom * 1.2) }));
    const handleZoomOut = () => setViewState(prev => ({ ...prev, zoom: Math.max(0.05, prev.zoom / 1.2) }));
    
    const handleFitToScreen = () => {
        // Calculate available space dynamically
        const header = document.querySelector('header');
        const leftSidebar = document.querySelector('aside:first-of-type');
        const rightSidebar = document.querySelector('aside:last-of-type');

        const headerHeight = header ? header.getBoundingClientRect().height : 56;
        const leftSidebarWidth = leftSidebar ? leftSidebar.getBoundingClientRect().width : 56;
        const rightSidebarWidth = rightSidebar ? rightSidebar.getBoundingClientRect().width : 320;
        const rulerBreadth = 30;
        const padding = 40; // Total padding (20px each side)

        const availableWidth = window.innerWidth - leftSidebarWidth - rightSidebarWidth;
        const availableHeight = window.innerHeight - headerHeight;

        // The actual area for drawing content (inside rulers)
        const contentAreaWidth = availableWidth - rulerBreadth;
        const contentAreaHeight = availableHeight - rulerBreadth;

        if (contentAreaWidth <= 0 || contentAreaHeight <= 0) return;

        // Calculate scale to fit with padding
        const scaleX = (contentAreaWidth - padding) / canvasConfig.width;
        const scaleY = (contentAreaHeight - padding) / canvasConfig.height;
        
        // Cap zoom at 100% (1.0)
        const newZoom = Math.min(scaleX, scaleY, 1.0);

        // Center canvas in the content area
        const panX = (contentAreaWidth - (canvasConfig.width * newZoom)) / 2;
        const panY = (contentAreaHeight - (canvasConfig.height * newZoom)) / 2;

        setViewState({ zoom: newZoom, pan: { x: panX, y: panY } });
    };

    const handleFitCanvasToView = () => {
        // Calculate available space dynamically
        const header = document.querySelector('header');
        const leftSidebar = document.querySelector('aside:first-of-type');
        const rightSidebar = document.querySelector('aside:last-of-type');


        const headerHeight = header ? header.getBoundingClientRect().height : 56;
        const leftSidebarWidth = leftSidebar ? leftSidebar.getBoundingClientRect().width : 56;
        const rightSidebarWidth = rightSidebar ? rightSidebar.getBoundingClientRect().width : 320;
        const rulerBreadth = 30;
        const padding = 40; // Total padding (20px each side)

        const availableWidth = window.innerWidth - leftSidebarWidth - rightSidebarWidth;
        const availableHeight = window.innerHeight - headerHeight;

        // The actual area for drawing content (inside rulers)
        const contentAreaWidth = availableWidth - rulerBreadth;
        const contentAreaHeight = availableHeight - rulerBreadth;

        if (contentAreaWidth <= 0 || contentAreaHeight <= 0) return;

        const scaleX = (contentAreaWidth - padding) / canvasConfig.width;
        
        const newZoom = Math.min(scaleX, canvasConfig.height);
        const newCanvasHeight = contentAreaHeight - padding;
        const panX = (contentAreaWidth - (canvasConfig.width * newZoom)) / 2;
        const panY = (contentAreaHeight - newCanvasHeight) / 2;

        setViewState({ zoom: newZoom, pan: { x: panX, y:panY } });
    };

    const handleReset100 = () => {
        // Same dynamic calculation for Reset 100% to center it
        const header = document.querySelector('header');
        const leftSidebar = document.querySelector('aside:first-of-type');
        const rightSidebar = document.querySelector('aside:last-of-type');

        const headerHeight = header ? header.getBoundingClientRect().height : 56;
        const leftSidebarWidth = leftSidebar ? leftSidebar.getBoundingClientRect().width : 56;
        const rightSidebarWidth = rightSidebar ? rightSidebar.getBoundingClientRect().width : 320;
        const rulerBreadth = 30;

        const availableWidth = window.innerWidth - leftSidebarWidth - rightSidebarWidth;
        const availableHeight = window.innerHeight - headerHeight;

        const contentAreaWidth = availableWidth - rulerBreadth;
        const contentAreaHeight = availableHeight - rulerBreadth;
        
        const panX = (contentAreaWidth - canvasConfig.width) / 2;
        const panY = (contentAreaHeight - canvasConfig.height) / 2;
        
        setViewState({ zoom: 1, pan: { x: panX, y: panY } });
    };

    const onImportSVG = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleInitiateImport(e.target.files[0], 'svg');
            e.target.value = ''; // Reset input
        }
    };

    const groupClass = "flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800";
    const separatorClass = "w-px h-5 bg-slate-700 mx-1";
    const buttonClass = "flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none";
    const iconButtonClass = "p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none";

    // Helper for layout menu buttons
    const LayoutMenuButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }> = ({ onClick, title, children, disabled }) => (
        <button
            onClick={onClick}
            title={title}
            disabled={disabled}
            className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-700 flex items-center justify-center"
        >
            {children}
        </button>
    );

    return (
        <header className="flex-shrink-0 h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20 select-none relative shadow-md">
            
            {/* Left: Branding & File Actions */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5 text-slate-200 cursor-default">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <span className="font-bold text-base tracking-tight">Vectored</span>
                </div>

                <div className="h-5 w-px bg-slate-800 mx-2 hidden md:block"></div>

                <div className={`${groupClass} hidden md:flex`}>
                    <button onClick={handleNewProject} className={buttonClass} title="New Project">
                        <span>New</span>
                    </button>
                    <button onClick={() => loadInputRef.current?.click()} className={buttonClass} title="Open Project">
                        <span>Open</span>
                    </button>
                    <button onClick={handleSaveProjectFile} className={buttonClass} title="Save Project">
                        <span>Save</span>
                    </button>
                    <div className={separatorClass}></div>
                    <button onClick={() => importSvgRef.current?.click()} className={buttonClass} title="Import SVG">
                        <ImportIcon className="w-3.5 h-3.5 mr-1.5" />
                        <span>Import</span>
                    </button>
                    <button onClick={() => setIsExportModalOpen(true)} className={buttonClass} title="Export Project">
                        <ImportIcon className="w-3.5 h-3.5 mr-1.5 rotate-180" />
                        <span>Export</span>
                    </button>
                </div>
                
                <input type="file" accept=".json" className="hidden" ref={loadInputRef} onChange={handleFileSelectedForLoad} />
                <input type="file" accept=".svg,image/svg+xml" className="hidden" ref={importSvgRef} onChange={onImportSVG} />
            </div>

            {/* Right: View & Utilities */}
            <div className="flex items-center gap-3">
                
                {/* Viewport Control Group (Zoom, Fit, Snap, Layout, Canvas Settings) */}
                <div className={groupClass}>
                    <button onClick={handleZoomOut} className={iconButtonClass} title="Zoom Out">
                        <ZoomOutIcon />
                    </button>
                    <button onClick={handleReset100} className="px-2 py-1 text-xs font-mono text-slate-400 hover:text-slate-200 min-w-[3.5rem] text-center" title="Reset to 100%">
                        {Math.round(viewState.zoom * 100)}%
                    </button>
                    <button onClick={handleZoomIn} className={iconButtonClass} title="Zoom In">
                        <ZoomInIcon />
                    </button>
                    
                    <div className={separatorClass}></div>
                    
                    <button onClick={handleFitToScreen} className={iconButtonClass} title="Fit to Screen">
                        <FitScreenIcon />
                    </button>

                    <button onClick={handleFitCanvasToView} className={iconButtonClass} title="Fit Canvas to View">
                        <FitCanvasIcon />
                    </button>

                    <div className={separatorClass}></div>

                    {/* Layout Menu (Alignment & Nesting) */}
                    <div className="relative">
                        <button 
                            ref={layoutButtonRef}
                            onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
                            className={`${iconButtonClass} ${isLayoutMenuOpen ? 'bg-slate-800 text-slate-200' : ''}`}
                            title="Canvas Layout & Nesting"
                        >
                            <LayoutIcon className="w-4 h-4" />
                        </button>
                        {isLayoutMenuOpen && (
                            <div ref={layoutMenuRef} className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3">
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Canvas Alignment</h3>
                                    <div className="grid grid-cols-6 gap-1">
                                        <LayoutMenuButton onClick={() => handleAlignToCanvas('align-left')} title="Align Left" disabled={selectedObjects.length === 0}><AlignLeftIcon /></LayoutMenuButton>
                                        <LayoutMenuButton onClick={() => handleAlignToCanvas('align-center-h')} title="Align Center Horizontal" disabled={selectedObjects.length === 0}><AlignCenterHIcon /></LayoutMenuButton>
                                        <LayoutMenuButton onClick={() => handleAlignToCanvas('align-right')} title="Align Right" disabled={selectedObjects.length === 0}><AlignRightIcon /></LayoutMenuButton>
                                        <LayoutMenuButton onClick={() => handleAlignToCanvas('align-top')} title="Align Top" disabled={selectedObjects.length === 0}><AlignTopIcon /></LayoutMenuButton>
                                        <LayoutMenuButton onClick={() => handleAlignToCanvas('align-center-v')} title="Align Center Vertical" disabled={selectedObjects.length === 0}><AlignCenterVIcon /></LayoutMenuButton>
                                        <LayoutMenuButton onClick={() => handleAlignToCanvas('align-bottom')} title="Align Bottom" disabled={selectedObjects.length === 0}><AlignBottomIcon /></LayoutMenuButton>
                                    </div>
                                </div>
                                
                                <div className="h-px bg-slate-700"></div>

                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Optimization</h3>
                                    <button 
                                        onClick={() => setIsNestingModalOpen(true)} 
                                        disabled={!activeLayerHasObjects}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <NestIcon className="w-4 h-4 text-cyan-400" />
                                        <span>Auto-Nest Objects</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Snap Menu */}
                    <div className="relative">
                        <button 
                            ref={snapButtonRef}
                            onClick={() => setIsSnapMenuOpen(!isSnapMenuOpen)}
                            className={`${iconButtonClass} ${isSnapMenuOpen ? 'bg-slate-800 text-slate-200' : ''}`}
                            title="Snapping Options"
                        >
                            <SnapIcon className="w-4 h-4" />
                        </button>
                        {isSnapMenuOpen && (
                            <div ref={snapMenuRef} className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Snapping</h3>
                                
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-slate-300">Smart Guides</label>
                                    <button 
                                        onClick={() => setSnapSettings({ ...snapSettings, smart: !snapSettings.smart })}
                                        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${snapSettings.smart ? 'bg-cyan-600' : 'bg-slate-600'}`}
                                    >
                                        <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${snapSettings.smart ? 'translate-x-4' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-slate-300">Snap to Grid</label>
                                    <button 
                                        onClick={() => setSnapSettings({ ...snapSettings, grid: !snapSettings.grid })}
                                        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${snapSettings.grid ? 'bg-cyan-600' : 'bg-slate-600'}`}
                                    >
                                        <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${snapSettings.grid ? 'translate-x-4' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {snapSettings.grid && (
                                    <div className="flex items-center justify-between pt-1">
                                        <label className="text-xs text-slate-400">Grid Size ({units})</label>
                                        <input 
                                            type="number" 
                                            min="0.1" 
                                            step={units === 'px' ? 1 : 0.1}
                                            value={
                                                (units === 'mm' 
                                                    ? (snapSettings.gridSize * 25.4 / dpi) 
                                                    : units === 'in' 
                                                        ? (snapSettings.gridSize / dpi) 
                                                        : snapSettings.gridSize
                                                ).toFixed(units === 'px' ? 0 : 2)
                                            }
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if(!isNaN(val) && val > 0) {
                                                    let pxVal = val;
                                                    if (units === 'mm') pxVal = (val * dpi) / 25.4;
                                                    else if (units === 'in') pxVal = val * dpi;
                                                    setSnapSettings({ ...snapSettings, gridSize: pxVal });
                                                }
                                            }}
                                            className="w-16 bg-slate-700 text-white text-xs rounded p-1 text-right focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                </div>
                <div className={groupClass}>
                <button onClick={() => setIsCanvasSettingsModalOpen(true)} className={buttonClass} title="Canvas Settings">
                        <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                    <div className={separatorClass}></div>
                    <button onClick={handlePrint} className={iconButtonClass} title="Print">
                        <PrintIcon className="w-4 h-4" />
                    </button>
                    <div className={separatorClass}></div>
                    <button onClick={() => setIsHelpModalOpen(true)} className={iconButtonClass} title="Help">
                        <HelpIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;