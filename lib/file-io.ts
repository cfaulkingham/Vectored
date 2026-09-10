import { isTauri } from '@tauri-apps/api/core';
import { IMAGE_EXTENSIONS, OPEN_EXTENSIONS, PROJECT_EXTENSION, projectName } from './project-format';

export type OpenedFile = { file: File; path: string | null };

/** Only dialog-selected or OS-delivered paths have filesystem access. */
export async function readNativeFile(path: string): Promise<OpenedFile> {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(path);
    const name = path.split(/[\\/]/).pop() || 'Untitled.vectored';
    const extension = name.split('.').pop()?.toLowerCase();
    const type = extension === 'svg' ? 'image/svg+xml'
        : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
        : IMAGE_EXTENSIONS.includes(extension || '') ? `image/${extension}` : 'application/json';
    return { file: new File([bytes], name, { type }), path };
}

/** Returns the actual chosen name/path only after a successful write. */
export async function saveProjectDocument(content: string, name: string, currentPath: string | null, saveAs = false) {
    const filename = `${name.replace(/\.(vectored|json)$/i, '') || 'Untitled'}.${PROJECT_EXTENSION}`;
    if (!isTauri()) {
        await saveFile(new Blob([content], { type: 'application/json' }), filename);
        return { path: null, name: projectName(filename) };
    }
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    // Legacy JSON is migrated using Save As; imported artwork is never overwritten.
    const canOverwrite = currentPath?.toLowerCase().endsWith('.vectored') && !saveAs;
    const path = canOverwrite ? currentPath : await save({
        title: 'Save Vectored project',
        defaultPath: currentPath ? currentPath.replace(/\.[^/.\\]+$/, '.vectored') : filename,
        filters: [{ name: 'Vectored project', extensions: [PROJECT_EXTENSION] }],
    });
    if (path === null) return null;
    await writeFile(path, new TextEncoder().encode(content));
    return { path, name: projectName(path) };
}

/** Save through the OS on desktop, or download in the browser. Cancellation is not success. */
export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
    if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const extension = filename.split('.').pop()?.toLowerCase();
        const path = await save({
            title: 'Save file',
            defaultPath: filename,
            filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : undefined,
        });
        if (path === null) return false;
        await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
        return true;
    }

    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    try {
        anchor.click();
    } finally {
        anchor.remove();
        // Give the browser time to start reading the blob before releasing it.
        setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
    return true;
}

/** Dialog-selected paths are granted temporary access by Tauri's dialog plugin. */
export async function chooseOpenFile(): Promise<OpenedFile | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({
        title: 'Open in Vectored',
        multiple: false,
        directory: false,
        filters: [
            { name: 'Supported files', extensions: OPEN_EXTENSIONS },
            { name: 'Vectored project', extensions: [PROJECT_EXTENSION, 'json'] },
            { name: 'SVG', extensions: ['svg'] },
            { name: 'Images', extensions: IMAGE_EXTENSIONS },
        ],
    });
    if (path === null) return null;
    return readNativeFile(path);
}

export async function openProjectFile(): Promise<File | null> {
    return (await chooseOpenFile())?.file ?? null;
}

export async function showFileError(action: string, error: unknown): Promise<void> {
    console.error(action, error);
    const detail = error instanceof Error ? error.message : String(error);
    const text = `${action}\n${detail}`;
    if (isTauri()) {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(text, { title: 'Vectored', kind: 'error' });
    } else {
        alert(text);
    }
}
