import type { AppState, Units } from '../types';

export const PROJECT_EXTENSION = 'vectored';
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
export const OPEN_EXTENSIONS = [PROJECT_EXTENSION, 'json', 'svg', ...IMAGE_EXTENSIONS];

export function fileKind(name: string): 'project' | 'svg' | 'image' | null {
    const extension = name.split('.').pop()?.toLowerCase();
    if (extension === PROJECT_EXTENSION || extension === 'json') return 'project';
    if (extension === 'svg') return 'svg';
    return IMAGE_EXTENSIONS.includes(extension || '') ? 'image' : null;
}

export function projectName(name: string): string {
    return (name.split(/[\\/]/).pop() || 'Untitled').replace(/\.[^/.]+$/, '');
}

export function serializeProject(state: AppState, units: Units): string {
    return JSON.stringify({ format: 'vectored', version: 1, units, ...state }, null, 2);
}

// Selection and in-flight generation flags aren't document edits. Content equality also
// recognizes undo back to the saved version, even after the history buffer rolls over.
export function projectFingerprint(state: AppState, units: Units): string {
    return JSON.stringify({
        layers: state.layers.map(({ isGenerating, ...layer }) => layer),
        canvasConfig: state.canvasConfig,
        guides: state.guides,
        units,
    });
}

export function parseProject(text: string): { state: AppState; units: Units } {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' ||
        (data.format !== undefined && data.format !== 'vectored') ||
        (data.version !== undefined && data.version !== 1)) {
        throw new Error('This project format or version is not supported.');
    }
    const config = data.canvasConfig;
    if (!Array.isArray(data.layers) || !data.layers.length || !config ||
        !Number.isFinite(config.width) || config.width <= 0 ||
        !Number.isFinite(config.height) || config.height <= 0 ||
        (data.guides !== undefined && !Array.isArray(data.guides))) {
        throw new Error('Invalid Vectored project.');
    }
    const ids = new Set<string>();
    for (const layer of data.layers) {
        if (!layer || typeof layer.id !== 'string' || ids.has(layer.id) ||
            !layer.settings || typeof layer.settings !== 'object' ||
            (layer.objects !== undefined && !Array.isArray(layer.objects)) ||
            (layer.points !== undefined && !Array.isArray(layer.points))) {
            throw new Error('Invalid project layer.');
        }
        ids.add(layer.id);
        layer.objects ??= [];
        layer.points ??= [];
        layer.isGenerating = false;
    }
    if (data.units !== undefined && !['mm', 'in', 'px'].includes(data.units)) {
        throw new Error('Invalid project units.');
    }
    return {
        state: {
            layers: data.layers,
            activeLayerId: ids.has(data.activeLayerId) ? data.activeLayerId : data.layers[0].id,
            canvasConfig: config,
            guides: data.guides ?? [],
        },
        units: data.units ?? 'mm',
    };
}
