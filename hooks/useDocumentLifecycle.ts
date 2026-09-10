import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { projectFingerprint, serializeProject } from '../lib/project-format';
import { saveProjectDocument, showFileError } from '../lib/file-io';
import type { AppState, Units } from '../types';

type Decision = 'save' | 'discard' | 'cancel';

/** One save checkpoint shared by New, Open, Close, Quit, and the browser unload guard. */
export function useDocumentLifecycle(appState: AppState, units: Units) {
    const fingerprint = useMemo(() => projectFingerprint(appState, units),
        [appState.layers, appState.canvasConfig, appState.guides, units]);
    const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
    const [filename, setFilename] = useState('Untitled');
    const [documentPath, setDocumentPath] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isActionBusy, setIsActionBusy] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [unsavedAction, setUnsavedAction] = useState<string | null>(null);
    const decisionResolver = useRef<((decision: Decision) => void) | null>(null);
    const saveResolver = useRef<((saved: boolean) => void) | null>(null);
    const saving = useRef(false);
    const actionBusy = useRef(false);
    const checkpoint = useRef(savedFingerprint);
    const current = useRef({ appState, units, fingerprint, filename, documentPath });
    current.current = { appState, units, fingerprint, filename, documentPath };
    const isDirty = fingerprint !== savedFingerprint;

    const markClean = useCallback((state: AppState, nextUnits: Units, name: string, path: string | null) => {
        checkpoint.current = projectFingerprint(state, nextUnits);
        setSavedFingerprint(checkpoint.current);
        setFilename(name);
        setDocumentPath(path);
    }, []);

    const save = useCallback(async (saveAs = false, name = current.current.filename): Promise<boolean> => {
        if (saving.current) return false;
        saving.current = true;
        setIsSaving(true);
        const snapshot = current.current;
        try {
            const result = await saveProjectDocument(
                serializeProject(snapshot.appState, snapshot.units), name, snapshot.documentPath, saveAs,
            );
            if (!result) return false;
            // A save marks only the captured version clean. Edits during I/O remain dirty.
            checkpoint.current = snapshot.fingerprint;
            setSavedFingerprint(snapshot.fingerprint);
            setFilename(result.name);
            setDocumentPath(result.path);
            return true;
        } catch (error) {
            await showFileError('Could not save the project.', error);
            return false;
        } finally {
            saving.current = false;
            setIsSaving(false);
        }
    }, []);

    const requestSave = useCallback(async (saveAs = false) => {
        if (saving.current || saveResolver.current) return false;
        if (isTauri()) return save(saveAs);
        setIsSaveModalOpen(true);
        return new Promise<boolean>(resolve => { saveResolver.current = resolve; });
    }, [save]);

    const handleSave = async (name: string) => {
        if (!await save(true, name)) return;
        setIsSaveModalOpen(false);
        saveResolver.current?.(true);
        saveResolver.current = null;
    };

    const handleCancelSave = () => {
        if (saving.current) return;
        setIsSaveModalOpen(false);
        saveResolver.current?.(false);
        saveResolver.current = null;
    };

    const resolveUnsaved = (decision: Decision) => {
        setUnsavedAction(null);
        decisionResolver.current?.(decision);
        decisionResolver.current = null;
    };

    const confirmUnsaved = useCallback(async (action: string): Promise<boolean> => {
        if (current.current.fingerprint === checkpoint.current) return true;
        let decision: Decision;
        if (isTauri()) {
            const { message } = await import('@tauri-apps/plugin-dialog');
            const result = await message(`Save changes to “${current.current.filename}” before ${action}?`, {
                title: 'Unsaved changes', kind: 'warning',
                buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
            });
            decision = result === 'Save' || result === 'Yes' ? 'save'
                : result === "Don't Save" || result === 'No' ? 'discard' : 'cancel';
        } else {
            setUnsavedAction(action);
            decision = await new Promise<Decision>(resolve => { decisionResolver.current = resolve; });
        }
        if (decision === 'discard') return true;
        if (decision === 'cancel') return false;
        return await requestSave() && current.current.fingerprint === checkpoint.current;
    }, [requestSave]);

    // Competing file/menu/close requests cannot bypass an unresolved save or prompt.
    const runGuarded = useCallback(async (action: string, proceed: () => void | Promise<void>) => {
        if (actionBusy.current || saving.current || saveResolver.current) return false;
        actionBusy.current = true;
        setIsActionBusy(true);
        try {
            if (!await confirmUnsaved(action)) return false;
            await proceed();
            return true;
        } catch (error) {
            await showFileError('Could not complete the document operation.', error);
            return false;
        } finally {
            actionBusy.current = false;
            setIsActionBusy(false);
        }
    }, [confirmUnsaved]);

    const handleSaveProjectFile = useCallback(() => {
        if (!actionBusy.current) void requestSave();
    }, [requestSave]);
    const handleSaveAs = useCallback(() => {
        if (!actionBusy.current) void requestSave(true);
    }, [requestSave]);

    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (current.current.fingerprint !== checkpoint.current || saving.current) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, []);

    useEffect(() => {
        const title = `${isDirty ? '● ' : ''}${filename} — Vectored`;
        document.title = title;
        if (isTauri()) {
            void invoke('set_document_status', { title }).catch(console.error);
        }
    }, [filename, isDirty]);

    useEffect(() => () => {
        decisionResolver.current?.('cancel');
        saveResolver.current?.(false);
    }, []);

    return {
        filename, setFilename, documentPath, isDirty, isSaving, isActionBusy, markClean, runGuarded,
        isSaveModalOpen, handleSave, handleCancelSave, handleSaveProjectFile, handleSaveAs,
        unsavedAction, resolveUnsaved,
    };
}
