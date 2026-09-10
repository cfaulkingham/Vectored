import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveFile, openProjectFile } from '../lib/file-io';

const mocks = vi.hoisted(() => ({
    isTauri: vi.fn(), save: vi.fn(), open: vi.fn(), writeFile: vi.fn(), readFile: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save, open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: mocks.writeFile, readFile: mocks.readFile }));

describe('desktop files', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.isTauri.mockReturnValue(true);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('does not write or report success when saving is canceled', async () => {
        mocks.save.mockResolvedValue(null);
        expect(await saveFile(new Blob(['project']), 'project.json')).toBe(false);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it.each(['json', 'svg', 'png', 'pdf', 'dxf'])('writes exact %s bytes to the chosen path', async extension => {
        const bytes = new Uint8Array([0, 10, 127, 128, 255]);
        const path = `/chosen/renamed.${extension}`;
        mocks.save.mockResolvedValue(path);
        expect(await saveFile(new Blob([bytes]), `drawing.${extension}`)).toBe(true);
        expect(mocks.writeFile).toHaveBeenCalledWith(path, bytes);
        expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
            defaultPath: `drawing.${extension}`,
            filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        }));
    });

    it('propagates disk errors so the UI can keep the project open', async () => {
        mocks.save.mockResolvedValue('/read-only/project.json');
        mocks.writeFile.mockRejectedValue(new Error('Permission denied'));
        await expect(saveFile(new Blob(['{}']), 'project.json')).rejects.toThrow('Permission denied');
    });

    it('does not read anything when opening is canceled', async () => {
        mocks.open.mockResolvedValue(null);
        expect(await openProjectFile()).toBeNull();
        expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it.each(['/projects/art.json', 'C:\\projects\\art.json'])('loads a selected project from %s', async path => {
        mocks.open.mockResolvedValue(path);
        mocks.readFile.mockResolvedValue(new TextEncoder().encode('{"layers":[]}'));
        const file = await openProjectFile();
        expect(file?.name).toBe('art.json');
        expect(await file?.text()).toBe('{"layers":[]}');
        expect(mocks.readFile).toHaveBeenCalledWith(path);
    });

    it('keeps browser downloads working and releases their URLs after dispatch', async () => {
        vi.useFakeTimers();
        mocks.isTauri.mockReturnValue(false);
        const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
        const appendChild = vi.fn();
        vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild } });
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        expect(await saveFile(new Blob(['{}']), 'art.json')).toBe(true);
        expect(anchor.download).toBe('art.json');
        expect(anchor.click).toHaveBeenCalledOnce();
        expect(anchor.remove).toHaveBeenCalledOnce();
        expect(revoke).not.toHaveBeenCalled();
        vi.runAllTimers();
        expect(revoke).toHaveBeenCalledWith('blob:download');
        expect(mocks.save).not.toHaveBeenCalled();
    });
});
