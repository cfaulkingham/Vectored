

import React, { useRef, useEffect, useState } from 'react';
import Canvas from './Canvas';
import TopBar from './TopBar';
import RightSidebar from './RightSidebar';
import VerticalToolbar from './VerticalToolbar';
import { ModalManager } from './ModalManager';
import { StatusBar } from './StatusBar';
import { CommandBar } from './CommandBar';
import { useEditor } from '../context/EditorContext';

/**
 * The main layout component for the Editor.
 * It organizes the major UI areas: Top Bar, Vertical Toolbar, Canvas, and Right Sidebar.
 * Also handles initial canvas fitting to the viewport and responsive resizing.
 */
export const EditorLayout: React.FC = () => {
    const { 
        canvasConfig,
        guides,
        renderData,
        handleCanvasMouseDown, handleRulerMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasDoubleClick,
        handleUpdateTextContent, handleFinishTextEditing,
        activeLayer, activeLayerId, selectedObjects,
        interaction, editingMode, activeTool, viewState, setViewState,
        mirrorMode, mirrorGap,
        patternPreviewData,
        units,
        dpi
    } = useEditor();

    const RULER_BREADTH = 30;
    const containerRef = useRef<HTMLDivElement>(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const lastFittedConfig = useRef<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setViewportSize({ width, height });
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Fit canvas to viewport only when canvas dimensions change or initially
    useEffect(() => {
        if (viewportSize.width > 0 && viewportSize.height > 0) {
             // Check if we need to fit (initial load or config change)
             const needsFit = !lastFittedConfig.current || 
                lastFittedConfig.current.width !== canvasConfig.width || 
                lastFittedConfig.current.height !== canvasConfig.height;

             if (needsFit) {
                 const availableWidth = viewportSize.width - RULER_BREADTH - 40; // 40px padding
                 const availableHeight = viewportSize.height - RULER_BREADTH - 40;
                 
                 const scaleX = availableWidth / canvasConfig.width;
                 const scaleY = availableHeight / canvasConfig.height;
                 
                 // Fit entire canvas but limit max auto-zoom to 100% (1.0)
                 const newZoom = Math.min(scaleX, scaleY, 1.0);
                 
                 const centerX = (viewportSize.width - RULER_BREADTH - (canvasConfig.width * newZoom)) / 2;
                 const centerY = (viewportSize.height - RULER_BREADTH - (canvasConfig.height * newZoom)) / 2;
                 
                 setViewState({ zoom: newZoom, pan: { x: centerX, y: centerY } });
                 lastFittedConfig.current = canvasConfig;
             }
        }
    }, [canvasConfig, viewportSize.width, viewportSize.height, setViewState]);

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans antialiased overflow-hidden selection:bg-cyan-500/30">
            <TopBar />
            <main className="flex flex-grow overflow-hidden relative">
                <VerticalToolbar />
                <div ref={containerRef} className="flex-grow relative bg-slate-900 overflow-hidden cursor-crosshair">
                    {viewportSize.width > 0 && (
                        <Canvas
                            width={canvasConfig.width}
                            height={canvasConfig.height}
                            viewportWidth={viewportSize.width}
                            viewportHeight={viewportSize.height}
                            clipToCanvas={canvasConfig.clipToCanvas}
                            onCanvasMouseDown={handleCanvasMouseDown}
                            onRulerMouseDown={handleRulerMouseDown}
                            onCanvasMouseMove={handleCanvasMouseMove}
                            onCanvasMouseUp={handleCanvasMouseUp}
                            onCanvasDoubleClick={handleCanvasDoubleClick}
                            onUpdateTextContent={handleUpdateTextContent}
                            onFinishTextEditing={handleFinishTextEditing}
                            rulerBreadth={RULER_BREADTH}
                            guides={guides}
                            renderData={renderData}
                            interaction={interaction}
                            editingMode={editingMode}
                            activeLayerClipPolygonPoints={activeLayer?.clipPolygonPoints || []}
                            isLayerClipPolygonClosed={activeLayer?.isClipPolygonClosed || false}
                            activeLayerId={activeLayerId}
                            units={units}
                            dpi={dpi}
                            selectedObjects={selectedObjects}
                            activeTool={activeTool}
                            viewState={viewState}
                            setViewState={setViewState}
                            mirrorMode={mirrorMode}
                            mirrorGap={mirrorGap}
                            patternPreviewData={patternPreviewData}
                            patternPreviewObjects={selectedObjects}
                        />
                    )}
                </div>
                <RightSidebar />
            </main>
            <StatusBar />
            <ModalManager />
            <CommandBar />
        </div>
    );
};