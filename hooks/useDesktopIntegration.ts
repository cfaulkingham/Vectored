import { useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { readNativeFile, showFileError, type OpenedFile } from '../lib/file-io';

type Handlers = {
    open: (file: OpenedFile) => Promise<void>;
    close: () => Promise<unknown>;
    command: (command: string) => void;
    blocked: boolean;
};

export function useDesktopIntegration(handlers: Handlers) {
    const latest = useRef(handlers);
    latest.current = handlers;
    const [paths, setPaths] = useState<string[]>([]);
    const processing = useRef(false);

    useEffect(() => {
        if (!isTauri()) return;
        let disposed = false;
        const unlisteners: (() => void)[] = [];
        // Subscribe before draining Rust's queue: startup opens and events arriving
        // during frontend initialization are delivered once, without a timing window.
        const drain = async () => {
            const pending = await invoke<string[]>('take_pending_files');
            if (!disposed) setPaths(previous => [...previous, ...pending]);
        };
        void (async () => {
            const { listen } = await import('@tauri-apps/api/event');
            for (const [event, handler] of [
                ['desktop-files-available', () => { void drain().catch(console.error); }],
                ['desktop-close-requested', () => { void latest.current.close(); }],
                ['desktop-file-command', (event: { payload: string }) => {
                    if (!latest.current.blocked) latest.current.command(event.payload);
                }],
            ] as const) {
                const unlisten = await listen(event, handler);
                if (disposed) { unlisten(); return; }
                unlisteners.push(unlisten);
            }
            await invoke('desktop_ready');
            if (!disposed) await drain();
        })().catch(error => { void showFileError('Could not initialize desktop file handling.', error); });
        return () => { disposed = true; unlisteners.forEach(unlisten => unlisten()); };
    }, []);

    useEffect(() => {
        if (handlers.blocked || processing.current || !paths.length) return;
        processing.current = true;
        void (async () => {
            try {
                await latest.current.open(await readNativeFile(paths[0]));
            } catch (error) {
                await showFileError('Could not open the file.', error);
            } finally {
                processing.current = false;
                setPaths(previous => previous.slice(1));
            }
        })();
    }, [paths, handlers.blocked]);
}
