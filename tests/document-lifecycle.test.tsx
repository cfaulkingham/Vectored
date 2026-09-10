// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentLifecycle } from '../hooks/useDocumentLifecycle';
import { createInitialState } from '../lib/layer-helpers';
import type { Units } from '../types';

const mocks = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn(), message: vi.fn(), save: vi.fn(), error: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri, invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ message: mocks.message }));
vi.mock('../lib/file-io', () => ({ saveProjectDocument: mocks.save, showFileError: mocks.error }));

function setup() {
    const initial = createInitialState();
    const changed = { ...initial, canvasConfig: { width: 1200, height: 800 } };
    const hook = renderHook(({ state, units }) => useDocumentLifecycle(state, units), {
        initialProps: { state: initial, units: 'mm' as Units },
    });
    return { ...hook, initial, changed, edit: () => hook.rerender({ state: changed, units: 'mm' }) };
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockResolvedValue(undefined);
    mocks.save.mockResolvedValue({ path: '/art.vectored', name: 'art' });
});
afterEach(cleanup);

describe('document checkpoint', () => {
    it('tracks edits, saves, undo to the saved contents, and units independently of undo availability', async () => {
        const { result, edit, rerender, initial, changed } = setup();
        expect(result.current.isDirty).toBe(false);
        edit();
        expect(result.current.isDirty).toBe(true);
        await act(async () => { result.current.handleSaveProjectFile(); });
        expect(result.current.documentPath).toBe('/art.vectored');
        expect(result.current.isDirty).toBe(false);
        rerender({ state: initial, units: 'mm' });
        expect(result.current.isDirty).toBe(true);
        rerender({ state: changed, units: 'mm' });
        expect(result.current.isDirty).toBe(false);
        rerender({ state: changed, units: 'in' });
        expect(result.current.isDirty).toBe(true);
    });

    it('does not mark layer selection or a transient generation flag as edits', () => {
        const { result, rerender, initial } = setup();
        rerender({ state: { ...initial, activeLayerId: null, layers: initial.layers.map(layer => ({ ...layer, isGenerating: true })) }, units: 'mm' });
        expect(result.current.isDirty).toBe(false);
    });

    it('marks the newly opened document clean with its own path and units', () => {
        const { result, rerender, changed } = setup();
        act(() => result.current.markClean(changed, 'px', 'loaded', '/loaded.vectored'));
        rerender({ state: changed, units: 'px' });
        expect(result.current.isDirty).toBe(false);
        expect(result.current.filename).toBe('loaded');
        expect(document.title).toBe('loaded — Vectored');
    });

    it('keeps edits made during a write dirty', async () => {
        const { result, edit, rerender, changed } = setup();
        edit();
        let finish!: (value: object) => void;
        mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        act(() => result.current.handleSaveProjectFile());
        rerender({ state: { ...changed, guides: [{ id: 'g', position: 42, orientation: 'horizontal' }] }, units: 'mm' });
        await act(async () => finish({ path: '/art.vectored', name: 'art' }));
        expect(result.current.isDirty).toBe(true);
    });
});

describe('save before a destructive action', () => {
    it.each(['opening another project', 'creating a new project', 'closing Vectored'])('cancels %s without changing the checkpoint', async action => {
        const { result, edit } = setup();
        edit();
        mocks.message.mockResolvedValue('Cancel');
        const proceed = vi.fn();
        await act(async () => { expect(await result.current.runGuarded(action, proceed)).toBe(false); });
        expect(proceed).not.toHaveBeenCalled();
        expect(mocks.save).not.toHaveBeenCalled();
        expect(result.current.isDirty).toBe(true);
    });

    it.each(['cancel', 'failure'])('does not close/open/new when saving ends in %s', async outcome => {
        const { result, edit } = setup();
        edit();
        mocks.message.mockResolvedValue('Save');
        if (outcome === 'cancel') mocks.save.mockResolvedValue(null);
        else mocks.save.mockRejectedValue(new Error('Disk full'));
        const proceed = vi.fn();
        await act(async () => { expect(await result.current.runGuarded('closing Vectored', proceed)).toBe(false); });
        expect(proceed).not.toHaveBeenCalled();
        expect(result.current.isDirty).toBe(true);
        if (outcome === 'failure') expect(mocks.error).toHaveBeenCalled();
    });

    it('waits for the write to finish before proceeding', async () => {
        const { result, edit } = setup();
        edit();
        mocks.message.mockResolvedValue('Save');
        let finish!: (value: object) => void;
        mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const proceed = vi.fn();
        let action!: Promise<boolean>;
        act(() => { action = result.current.runGuarded('closing Vectored', proceed); });
        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
        expect(proceed).not.toHaveBeenCalled();
        await act(async () => { finish({ path: '/art.vectored', name: 'art' }); expect(await action).toBe(true); });
        expect(proceed).toHaveBeenCalledOnce();
        expect(result.current.isDirty).toBe(false);
    });

    it('aborts closing when a newer edit arrives during the save', async () => {
        const { result, edit, rerender, changed } = setup();
        edit();
        mocks.message.mockResolvedValue('Save');
        let finish!: (value: object) => void;
        mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const proceed = vi.fn();
        let action!: Promise<boolean>;
        act(() => { action = result.current.runGuarded('closing', proceed); });
        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
        rerender({ state: changed, units: 'in' });
        await act(async () => { finish({ path: '/art.vectored', name: 'art' }); expect(await action).toBe(false); });
        expect(proceed).not.toHaveBeenCalled();
        expect(result.current.isDirty).toBe(true);
    });

    it('ignores competing close/open requests while a decision is pending', async () => {
        const { result, edit } = setup();
        edit();
        let decide!: (value: string) => void;
        mocks.message.mockReturnValue(new Promise(resolve => { decide = resolve; }));
        const first = vi.fn(), second = vi.fn();
        let action!: Promise<boolean>;
        act(() => { action = result.current.runGuarded('closing', first); });
        await waitFor(() => expect(mocks.message).toHaveBeenCalledOnce());
        await act(async () => { expect(await result.current.runGuarded('opening', second)).toBe(false); });
        await act(async () => { decide("Don't Save"); await action; });
        expect(first).toHaveBeenCalledOnce();
        expect(second).not.toHaveBeenCalled();
    });

    it('continues without prompting when the document is clean', async () => {
        const { result } = setup();
        const proceed = vi.fn();
        await act(async () => { await result.current.runGuarded('closing', proceed); });
        expect(proceed).toHaveBeenCalledOnce();
        expect(mocks.message).not.toHaveBeenCalled();
    });

    it('keeps the browser project when its save-name dialog is canceled', async () => {
        mocks.isTauri.mockReturnValue(false);
        const { result, edit } = setup();
        edit();
        const proceed = vi.fn();
        let action!: Promise<boolean>;
        act(() => { action = result.current.runGuarded('opening', proceed); });
        expect(result.current.unsavedAction).toBe('opening');
        await act(async () => result.current.resolveUnsaved('save'));
        expect(result.current.isSaveModalOpen).toBe(true);
        await act(async () => { result.current.handleCancelSave(); await action; });
        expect(proceed).not.toHaveBeenCalled();
        expect(result.current.isDirty).toBe(true);
    });

    it('warns on browser reload only for unsaved changes', () => {
        mocks.isTauri.mockReturnValue(false);
        const { edit } = setup();
        const clean = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(clean);
        expect(clean.defaultPrevented).toBe(false);
        edit();
        const dirty = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(dirty);
        expect(dirty.defaultPrevented).toBe(true);
    });
});
