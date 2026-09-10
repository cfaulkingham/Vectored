import { describe, it, expect } from 'vitest';
import { generateSpirograph, generateGuilloche } from '../lib/generators/geometric';
import { generateLivingHinge, generateBoxJoint } from '../lib/generators/fabrication';
import type { GeneratorContext } from '../lib/generators/utils';
import type { LayerSettings } from '../types';
import { generateRoseCurve } from '../lib/generators/geometric';
import { generateVoronoi } from '../lib/generators/distribution';

describe('Generators & Pattern Engines', () => {
    it('generates rose curves with bundled D3 and no browser global', () => {
        const result = generateRoseCurve({
            settings: { roseN: 3, roseD: 2, roseKMax: 360 } as LayerSettings,
            bounds: { x: 0, y: 0, width: 100, height: 100 }, random: () => 0.5, densityMap: undefined,
        });
        expect(result && 'paths' in result && result.paths[0]).toMatch(/^M/);
    });

    it('generates Voronoi cells with bundled D3 and no browser global', () => {
        const result = generateVoronoi({
            settings: {} as LayerSettings,
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            points: [[20, 20], [80, 80]], random: () => 0.5, densityMap: undefined,
        });
        expect(result && 'paths' in result && result.paths.length).toBe(2);
    });

    const mockContext: GeneratorContext = {
        settings: {
            patternType: 'none',
            spirographrRatio: 0.5,
            spirographdRatio: 0.8,
            spirographLaps: 3,
            guillocheAmplitude1: 20,
            guillocheFrequency1: 5,
            guillocheAmplitude2: 10,
            guillocheFrequency2: 10,
            guillocheLaps: 2,
            livingHingeMargin: 10,
            livingHingeCutLength: 20,
            livingHingeGapSize: 5,
            livingHingeLineSpacing: 10,
            livingHingeOrientation: 'vertical',
            boxWidth: 50,
            boxHeight: 50,
            boxDepth: 50,
            materialThickness: 3,
            jointSize: 10
        } as unknown as LayerSettings,
        bounds: { x: 0, y: 0, width: 400, height: 400 },
        densityMap: undefined,
        random: () => 0.5
    };

    it('generates valid SVG path strings for Spirograph', () => {
        const result = generateSpirograph(mockContext);
        expect(result).toBeDefined();
        expect(result?.type).toBe('spirograph');
        if (result && 'paths' in result) {
            expect(result.paths.length).toBeGreaterThan(0);
            expect(result.paths[0]).toMatch(/^M/);
        }
    });

    it('generates valid SVG path strings for Guilloche pattern', () => {
        const result = generateGuilloche(mockContext);
        expect(result).toBeDefined();
        expect(result?.type).toBe('guilloche');
        if (result && 'paths' in result) {
            expect(result.paths.length).toBeGreaterThan(0);
            expect(result.paths[0]).toMatch(/^M/);
        }
    });

    it('generates living hinge fabrication cut paths', () => {
        const result = generateLivingHinge(mockContext);
        expect(result).toBeDefined();
        expect(result?.type).toBe('living-hinge');
        if (result && 'paths' in result) {
            expect(result.paths.length).toBeGreaterThan(0);
        }
    });

    it('generates laser-cut box joint paths', () => {
        const result = generateBoxJoint(mockContext);
        expect(result).toBeDefined();
        expect(result?.type).toBe('box-joint');
        if (result && 'paths' in result) {
            expect(result.paths.length).toBeGreaterThan(0);
        }
    });
});
