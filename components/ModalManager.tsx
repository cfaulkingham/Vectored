import React from 'react';
import ExportModal from './ExportModal';
import NewProjectModal from './NewProjectModal';
import SaveProjectModal from './SaveProjectModal';
import CanvasSettingsModal from './CanvasSettingsModal';
import ImportModal from './ImportModal';
import HelpModal from './HelpModal';
import NestingModal from './NestingModal';
import TraceImageModal from './TraceImageModal';
import { useEditor } from '../context/EditorContext';

/**
 * A centralized component to manage and render all global application modals.
 * Keeps the main layout clean by abstracting modal state and rendering logic.
 */
export const ModalManager: React.FC = () => {
    const { 
        projectManager, 
        units, setUnits, canvasConfig, handleCanvasConfigChange, dpi,
        appState, activeLayerId, selectedObjects
    } = useEditor();
    
    const {
        isNewProjectModalOpen, setIsNewProjectModalOpen, handleSaveAndNew, handleNewWithoutSaving,
        isSaveModalOpen, setIsSaveModalOpen, handleSave, filename, setFilename,
        isExportModalOpen, setIsExportModalOpen, handleExportSVG, handleExportPNG, handleExportPDF, handleExportDXF,
        pngExportScale, setPngExportScale,
        includeMeasurements, setIncludeMeasurements,
        isCanvasSettingsModalOpen, setIsCanvasSettingsModalOpen,
        isNewProjectSettingsOpen, setIsNewProjectSettingsOpen, handleCreateProject,
        isImportModalOpen, setIsImportModalOpen, handleConfirmImport, pendingImport,
        isHelpModalOpen, setIsHelpModalOpen,
        isNestingModalOpen, setIsNestingModalOpen, handleApplyNesting,
        isTraceModalOpen, setIsTraceModalOpen, imageToTrace, handleApplyTrace,
    } = projectManager;

    return (
        <>
            <NewProjectModal
                isOpen={isNewProjectModalOpen}
                onClose={() => setIsNewProjectModalOpen(false)}
                onSaveAndNew={handleSaveAndNew}
                onNewWithoutSaving={handleNewWithoutSaving}
            />
            <SaveProjectModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSave}
                initialFilename={filename}
            />
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExportSVG={handleExportSVG}
                onExportPNG={handleExportPNG}
                onExportPDF={handleExportPDF}
                onExportDXF={handleExportDXF}
                pngExportScale={pngExportScale}
                onPngExportScaleChange={setPngExportScale}
                filename={filename}
                onFilenameChange={setFilename}
            />
            <CanvasSettingsModal 
                isOpen={isCanvasSettingsModalOpen}
                onClose={() => setIsCanvasSettingsModalOpen(false)}
                units={units}
                onUnitsChange={setUnits}
                canvasConfig={canvasConfig}
                onCanvasConfigChange={handleCanvasConfigChange}
                dpi={dpi}
                mode="edit"
                includeMeasurements={includeMeasurements}
                onIncludeMeasurementsChange={setIncludeMeasurements}
            />
            <CanvasSettingsModal 
                isOpen={isNewProjectSettingsOpen}
                onClose={() => setIsNewProjectSettingsOpen(false)}
                units={units} // Pass current units as initial default
                canvasConfig={canvasConfig} // Pass current config as initial default
                onConfirm={handleCreateProject}
                dpi={dpi}
                mode="create"
            />
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onConfirm={handleConfirmImport}
                layers={appState.layers}
                initialLayerId={activeLayerId}
                type={pendingImport?.type || 'svg'}
            />
            <HelpModal 
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />
            <NestingModal
                isOpen={isNestingModalOpen}
                onClose={() => setIsNestingModalOpen(false)}
                appState={appState}
                onApply={handleApplyNesting}
            />
            {isTraceModalOpen && imageToTrace && (
                <TraceImageModal
                    isOpen={isTraceModalOpen}
                    onClose={() => setIsTraceModalOpen(false)}
                    imageObject={imageToTrace}
                    onApply={handleApplyTrace}
                />
            )}
        </>
    );
};