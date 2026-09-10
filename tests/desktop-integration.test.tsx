// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopIntegration } from '../hooks/useDesktopIntegration';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), read: vi.fn(), error: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }));
vi.mock('../lib/file-io', () => ({ readNativeFile: mocks.read, showFileError: mocks.error }));
let events: Map<string, (event?: unknown) => void>;
let pending: string[];

beforeEach(() => {
    vi.resetAllMocks();
    events = new Map();
    pending = [];
    mocks.listen.mockImplementation(async (name, callback) => {
        events.set(name, callback);
        return () => { if (events.get(name) === callback) events.delete(name); };
    });
    mocks.invoke.mockImplementation(async command => {
        if (command === 'take_pending_files') { const paths = pending; pending = []; return paths; }
    });
    mocks.read.mockImplementation(async path => ({ path, file: new File(['{}'], path.split('/').pop()) }));
});
afterEach(cleanup);

describe('native document event delivery', () => {
    it('drains startup files once after subscribing, including under StrictMode', async () => {
        pending = ['/startup.vectored'];
        const open = vi.fn().mockResolvedValue(undefined);
        renderHook(() => useDesktopIntegration({ open, close: vi.fn(), command: vi.fn(), blocked: false }), {
            wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
        });
        await waitFor(() => expect(open).toHaveBeenCalledOnce());
        expect(open.mock.calls[0][0].path).toBe('/startup.vectored');
        expect(events.size).toBe(3);
        const readyOrder = mocks.invoke.mock.invocationCallOrder[0];
        expect(mocks.listen.mock.invocationCallOrder.at(-1)).toBeLessThan(readyOrder);
    });

    it('queues files while a dialog is open and drains them in order', async () => {
        const open = vi.fn().mockResolvedValue(undefined);
        const { rerender } = renderHook(({ blocked }) => useDesktopIntegration({ open, close: vi.fn(), command: vi.fn(), blocked }), { initialProps: { blocked: true } });
        await waitFor(() => expect(events.size).toBe(3));
        pending = ['/first.svg', '/second.png'];
        await act(async () => events.get('desktop-files-available')?.());
        expect(open).not.toHaveBeenCalled();
        rerender({ blocked: false });
        await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
        expect(open.mock.calls.map(([file]) => file.path)).toEqual(['/first.svg', '/second.png']);
    });

    it('serializes incoming opens and routes quit through the guard callback', async () => {
        const close = vi.fn();
        let complete!: () => void;
        const open = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; })).mockResolvedValue(undefined);
        pending = ['/one.vectored', '/two.vectored'];
        renderHook(() => useDesktopIntegration({ open, close, command: vi.fn(), blocked: false }));
        await waitFor(() => expect(open).toHaveBeenCalledOnce());
        await act(async () => events.get('desktop-close-requested')?.());
        expect(close).toHaveBeenCalledOnce();
        expect(open).toHaveBeenCalledOnce();
        await act(async () => complete());
        await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
    });

    it('cleans up event listeners when unmounted', async () => {
        const { unmount } = renderHook(() => useDesktopIntegration({ open: vi.fn(), close: vi.fn(), command: vi.fn(), blocked: false }));
        await waitFor(() => expect(events.size).toBe(3));
        unmount();
        expect(events.size).toBe(0);
    });
});
