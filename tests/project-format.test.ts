import { describe, expect, it } from 'vitest';
import { createInitialState } from '../lib/layer-helpers';
import { fileKind, parseProject, projectFingerprint, projectName, serializeProject } from '../lib/project-format';

describe('Vectored project format', () => {
    it('round-trips the canvas, artwork, guides, and units in a versioned project', () => {
        const state = createInitialState();
        state.guides.push({ id: 'guide', orientation: 'vertical', position: 123 });
        const text = serializeProject(state, 'in');
        expect(JSON.parse(text)).toMatchObject({ format: 'vectored', version: 1, units: 'in' });
        expect(parseProject(text)).toEqual({ state, units: 'in' });
    });

    it('opens legacy JSON with missing guides and layer arrays', () => {
        const legacy = createInitialState();
        delete legacy.guides;
        delete legacy.layers[0].objects;
        delete legacy.layers[0].points;
        const { state, units } = parseProject(JSON.stringify(legacy));
        expect(state.guides).toEqual([]);
        expect(state.layers[0].objects).toEqual([]);
        expect(state.layers[0].points).toEqual([]);
        expect(units).toBe('mm');
    });

    it.each(['null', '{}', '{"format":"other"}', '{"version":2}', '{"layers":[],"canvasConfig":{"width":1,"height":1}}'])('rejects malformed or future projects: %s', text => {
        expect(() => parseProject(text)).toThrow();
    });

    it('rejects invalid dimensions and malformed layers before replacing the document', () => {
        const state = createInitialState();
        expect(() => parseProject(JSON.stringify({ ...state, canvasConfig: { width: -1, height: 1 } }))).toThrow();
        expect(() => parseProject(JSON.stringify({ ...state, layers: [{ id: 'a' }] }))).toThrow();
    });

    it('recognizes content equality without depending on state identity', () => {
        const state = createInitialState();
        expect(projectFingerprint(state, 'mm')).toBe(projectFingerprint(parseProject(serializeProject(state, 'mm')).state, 'mm'));
    });

    it.each([['ART.VECTORED', 'project'], ['legacy.json', 'project'], ['drawing.SVG', 'svg'], ['photo.JPEG', 'image'], ['photo.webp', 'image'], ['export.pdf', null], ['export.dxf', null]])('routes %s correctly', (name, kind) => {
        expect(fileKind(name)).toBe(kind);
    });

    it.each(['/art/my.drawing.vectored', 'C:\\art\\my.drawing.vectored'])('derives the document name from %s', path => {
        expect(projectName(path)).toBe('my.drawing');
    });
});
