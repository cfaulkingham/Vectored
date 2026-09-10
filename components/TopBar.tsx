import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from '../context/EditorContext';
import { isTauri } from '@tauri-apps/api/core';
import { openProjectFile, showFileError } from '../lib/file-io';
import { 
    ExportIcon, ImportIcon, PrintIcon, SettingsIcon, HelpIcon, SnapIcon, LayoutIcon,
    AlignLeftIcon, AlignCenterHIcon, AlignRightIcon, AlignTopIcon, AlignCenterVIcon, AlignBottomIcon, NestIcon,
    NewFileIcon, LoadIcon, SaveIcon
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

    const handleOpenProject = async () => {
        if (!isTauri()) {
            loadInputRef.current?.click();
            return;
        }
        try {
            const file = await openProjectFile();
            if (file) await projectManager.loadProjectFile(file);
        } catch (error) {
            await showFileError('Could not open the project.', error);
        }
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat) return;
            // Keep file commands from opening another modal over a pending operation.
            if (document.querySelector('[role="dialog"], .fixed.inset-0')) return;
            switch (event.key.toLowerCase()) {
                case 'n': event.preventDefault(); handleNewProject(); break;
                case 'o': event.preventDefault(); void handleOpenProject(); break;
                case 's': event.preventDefault(); handleSaveProjectFile(); break;
                case 'e': event.preventDefault(); setIsExportModalOpen(true); break;
                case 'i': event.preventDefault(); importSvgRef.current?.click(); break;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

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
        <header className="flex-shrink-0 h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-[60] select-none relative shadow-xl glass">
            
            {/* Left: Branding & Project Name */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2.5 text-slate-200 cursor-default group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none mb-1">Vectored</span>
                    <input 
                        type="text" 
                        defaultValue="Untitled Project" 
                        className="bg-transparent border-none outline-none text-slate-200 font-semibold text-xs py-0 h-auto focus:text-cyan-400 transition-colors w-40 truncate"
                    />
                </div>
            </div>

            {/* Center: Primary Tools & Actions */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                <div className={`${groupClass} bg-slate-900/50 backdrop-blur-sm`}>
                    <button onClick={handleNewProject} className={iconButtonClass} title="New Project (Ctrl+N)">
                        <NewFileIcon />
                    </button>
                    <button onClick={handleOpenProject} className={iconButtonClass} title="Open Project (Ctrl+O / ⌘O)">
                        <LoadIcon />
                    </button>
                    <button onClick={handleSaveProjectFile} className={iconButtonClass} title="Save Project (Ctrl+S)">
                        <SaveIcon />
                    </button>
                    
                    <div className={separatorClass}></div>
                    
                    <button onClick={() => importSvgRef.current?.click()} className={iconButtonClass} title="Import SVG (Ctrl+I)">
                        <ImportIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsExportModalOpen(true)} className={iconButtonClass} title="Export Project (Ctrl+E)">
                        <ExportIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className={`${groupClass} bg-slate-900/50 backdrop-blur-sm`}>
                    <button onClick={handleFitToScreen} className={iconButtonClass} title="Fit to Screen">
                        <FitScreenIcon />
                    </button>
                    <button onClick={handleZoomOut} className={iconButtonClass} title="Zoom Out">
                        <ZoomOutIcon />
                    </button>
                    <button onClick={handleReset100} className="px-3 py-1 text-xs font-mono text-slate-400 hover:text-cyan-400 min-w-[3.5rem] text-center transition-colors" title="Reset to 100%">
                        {Math.round(viewState.zoom * 100)}%
                    </button>
                    <button onClick={handleZoomIn} className={iconButtonClass} title="Zoom In">
                        <ZoomInIcon />
                    </button>
                </div>
            </div>

            {/* Right: Workspace Utilities */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
                    <button 
                        ref={snapButtonRef}
                        onClick={() => setIsSnapMenuOpen(!isSnapMenuOpen)}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${isSnapMenuOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                    >
                        <SnapIcon className="w-3.5 h-3.5" />
                        Snap
                    </button>
                    
                    <button 
                        ref={layoutButtonRef}
                        onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${isLayoutMenuOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                    >
                        <LayoutIcon className="w-3.5 h-3.5" />
                        Auto-Layout
                    </button>
                </div>

                <button 
                    onClick={() => setIsCanvasSettingsModalOpen(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
                    title="Document Settings"
                >
                    <SettingsIcon />
                </button>

                <button 
                    onClick={() => setIsHelpModalOpen(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
                    title="Keyboard Shortcuts & Help"
                >
                    <HelpIcon />
                </button>

                {/* Hidden Inputs */}
                <input type="file" accept=".json" className="hidden" ref={loadInputRef} onChange={handleFileSelectedForLoad} />
                <input type="file" accept=".svg,image/svg+xml" className="hidden" ref={importSvgRef} onChange={onImportSVG} />
            </div>

            {/* Snap Menu Popover */}
            {isSnapMenuOpen && (
                <div ref={snapMenuRef} className="absolute top-[52px] right-24 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-3 z-50 flex flex-col gap-3 animate-fade-in">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Snapping</h3>
                    
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-300 font-medium">Smart Guides</label>
                        <button 
                            onClick={() => setSnapSettings({ ...snapSettings, smart: !snapSettings.smart })}
                            className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${snapSettings.smart ? 'bg-indigo-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${snapSettings.smart ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-300 font-medium">Snap to Grid</label>
                        <button 
                            onClick={() => setSnapSettings({ ...snapSettings, grid: !snapSettings.grid })}
                            className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${snapSettings.grid ? 'bg-indigo-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${snapSettings.grid ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {snapSettings.grid && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-700 mt-1 pb-1">
                            <label className="text-xs text-slate-400 font-mono">Grid Size ({units})</label>
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
                                className="w-16 bg-slate-700 text-white text-xs rounded p-1 text-right focus:ring-1 focus:ring-cyan-500 outline-none"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Layout Menu Popover */}
            {isLayoutMenuOpen && (
                <div ref={layoutMenuRef} className="absolute top-[52px] right-4 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 z-50 flex flex-col gap-4 animate-fade-in">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Align Selection to Canvas</h3>
                        <div className="grid grid-cols-3 gap-2">
                             <button onClick={() => handleAlignToCanvas('align-left')} className={iconButtonClass} title="Align Left"><AlignLeftIcon /></button>
                             <button onClick={() => handleAlignToCanvas('align-center-h')} className={iconButtonClass} title="Align Center Horizontal"><AlignCenterHIcon /></button>
                             <button onClick={() => handleAlignToCanvas('align-right')} className={iconButtonClass} title="Align Right"><AlignRightIcon /></button>
                             <button onClick={() => handleAlignToCanvas('align-top')} className={iconButtonClass} title="Align Top"><AlignTopIcon /></button>
                             <button onClick={() => handleAlignToCanvas('align-center-v')} className={iconButtonClass} title="Align Center Vertical"><AlignCenterVIcon /></button>
                             <button onClick={() => handleAlignToCanvas('align-bottom')} className={iconButtonClass} title="Align Bottom"><AlignBottomIcon /></button>
                        </div>
                    </div>
                    
                    <div className="h-px bg-slate-700"></div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Production Optimization</h3>
                        <button 
                            onClick={() => setIsNestingModalOpen(true)} 
                            disabled={!activeLayerHasObjects}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            <NestIcon className="w-4 h-4" />
                            <span>Auto-Nest Objects</span>
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
};

export default TopBar;
