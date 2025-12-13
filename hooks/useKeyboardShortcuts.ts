

import React, { useEffect } from 'react';
import { produce } from 'immer';
import type { AppState, InteractionState } from '../types';

interface UseKeyboardShortcutsProps {
    undo: () => void;
    redo: () => void;
    handleCopySelectedObject: () => void;
    handlePasteObject: () => void;
    handleSelectAll: () => void;
    handleDeleteSelectedObjects: () => void;
    handleMoveSelectedObjects: (dx: number, dy: number) => void;
    handleFinishTextEditing: () => void;
    interaction: InteractionState;
    setInteraction: React.Dispatch<React.SetStateAction<InteractionState>>;
    selectedObjectInfo: { layerId: string; objectIds: string[] } | null;
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    editingMode: 'shape' | 'clip' | 'layer';
    setEditingMode: React.Dispatch<React.SetStateAction<'shape' | 'clip' | 'layer'>>;
    setActiveTool: React.Dispatch<React.SetStateAction<any>>;
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
}

/**
 * Custom hook to register global keyboard shortcuts.
 * Handles shortcuts for undo/redo (Ctrl+Z, Ctrl+Y), copy/paste (Ctrl+C, Ctrl+V),
 * selecting all (Ctrl+A), deleting (Delete/Backspace), nudging objects with arrow keys,
 * and cancelling operations with Escape.
 * Also manages tool switching shortcuts (V, R, L, P, T, B, I, M).
 *
 * @param props - The hook properties containing handlers for various actions.
 */
export const useKeyboardShortcuts = ({
    undo,
    redo,
    handleCopySelectedObject,
    handlePasteObject,
    handleSelectAll,
    handleDeleteSelectedObjects,
    handleMoveSelectedObjects,
    handleFinishTextEditing,
    interaction,
    setInteraction,
    selectedObjectInfo,
    setSelectedObjectInfo,
    editingMode,
    setEditingMode,
    setActiveTool,
    setAppState,
}: UseKeyboardShortcutsProps) => {

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
            if (e.key === ' ') {
                if (isTyping) return;
                e.preventDefault();
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (isTyping) return;
                if (selectedObjectInfo) {
                    e.preventDefault();
                    const amount = e.shiftKey ? 10 : 1;
                    let dx = 0, dy = 0;
                    switch (e.key) {
                        case 'ArrowUp': dy = -amount; break;
                        case 'ArrowDown': dy = amount; break;
                        case 'ArrowLeft': dx = -amount; break;
                        case 'ArrowRight': dx = amount; break;
                    }
                    handleMoveSelectedObjects(dx, dy);
                    return;
                }
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isTyping) return;
                if (selectedObjectInfo) {
                    handleDeleteSelectedObjects();
                }
            }

            // Tool shortcuts
            if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
                let toolChanged = false;
                if (e.key.toLowerCase() === 'b' && e.shiftKey) {
                    setActiveTool('pattern-brush');
                    toolChanged = true;
                } else if (!e.shiftKey) {
                    switch (e.key.toLowerCase()) {
                        case 'v': setActiveTool('select'); toolChanged = true; break;
                        case 'a': setActiveTool('node'); toolChanged = true; break;
                        case 'r': setActiveTool('shape'); toolChanged = true; break;
                        case 'l': setActiveTool('line'); toolChanged = true; break;
                        case 'p': setActiveTool('polygon'); toolChanged = true; break;
                        case 't': setActiveTool('text'); toolChanged = true; break;
                        case 'b': setActiveTool('path'); toolChanged = true; break;
                        case 'i': setActiveTool('image'); toolChanged = true; break;
                        case 'm': setActiveTool('measure'); toolChanged = true; break;
                    }
                }
                if (toolChanged) {
                    e.preventDefault();
                    setSelectedObjectInfo(null);
                }
            }

            if (e.key === 'Escape') {
                e.preventDefault(); // Prevent default browser behavior (like closing popups)

                if (interaction.mode === 'editing_text') {
                    handleFinishTextEditing();
                    return;
                }

                let shouldRemoveDrawnObject = false;

                if (interaction.mode === 'drawing_polygon' ||
                    interaction.mode === 'drawing_path' ||
                    interaction.mode === 'drawing_line' ||
                    interaction.mode === 'drawing_object') {
                    shouldRemoveDrawnObject = true;
                }

                setAppState(produce((draft: AppState) => {
                    if (draft.activeLayerId) {
                        const layer = draft.layers.find((l) => l.id === draft.activeLayerId);
                        if (layer) {
                            // If in clip path editing, clear and disable the clip path
                            if (editingMode === 'clip') {
                                layer.useClipping = false;
                                layer.clipPolygonPoints = [];
                                layer.isClipPolygonClosed = false;
                            }

                            // Remove the partially drawn object if applicable
                            if (shouldRemoveDrawnObject && selectedObjectInfo && selectedObjectInfo.objectIds.length === 1 && selectedObjectInfo.layerId === draft.activeLayerId) {
                                layer.objects = layer.objects.filter((obj) => obj.id !== selectedObjectInfo.objectIds[0]);
                            }
                        }
                    }
                }));

                // Reset other UI states directly
                setInteraction({ mode: 'idle' });
                setSelectedObjectInfo(null);
                setActiveTool('select');
                setEditingMode('shape');
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                let handled = false;
                switch (e.key.toLowerCase()) {
                    case 'z':
                        if (!isTyping) {
                            e.shiftKey ? redo() : undo();
                            handled = true;
                        }
                        break;
                    case 'y':
                         if (!isTyping) {
                            redo();
                            handled = true;
                        }
                        break;
                    case 'c':
                        if (!isTyping) {
                            handleCopySelectedObject();
                            handled = true;
                        }
                        break;
                    case 'v':
                        if (!isTyping) {
                            handlePasteObject();
                            handled = true;
                        }
                        break;
                    case 'a':
                        if (!isTyping) {
                            handleSelectAll();
                            setActiveTool('select');
                            handled = true;
                        }
                        break;
                }
                if (handled) {
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        selectedObjectInfo, setSelectedObjectInfo, handleDeleteSelectedObjects, handleCopySelectedObject, handlePasteObject, handleSelectAll, handleMoveSelectedObjects,
        undo, redo,
        setActiveTool,
        editingMode, setEditingMode,
        interaction.mode, setInteraction,
        setAppState,
        handleFinishTextEditing
    ]);
};