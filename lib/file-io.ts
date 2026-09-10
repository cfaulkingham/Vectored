import { isTauri } from '@tauri-apps/api/core';

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
export async function openProjectFile(): Promise<File | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const path = await open({
        title: 'Open Vectored project',
        multiple: false,
        directory: false,
        filters: [{ name: 'Vectored project', extensions: ['json'] }],
    });
    if (path === null) return null;
    const bytes = await readFile(path);
    const name = path.split(/[\\/]/).pop() || 'project.json';
    return new File([bytes], name, { type: 'application/json' });
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
