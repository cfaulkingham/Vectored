import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collect, metadata } from '../scripts/release.mjs';

const temporaryDirectories: string[] = [];
afterEach(() => {
    vi.unstubAllEnvs();
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
    const directory = mkdtempSync(path.join(tmpdir(), 'vectored-release-test-'));
    temporaryDirectories.push(directory);
    const bundle = path.join(directory, 'bundle');
    mkdirSync(path.join(bundle, 'msi'), { recursive: true });
    mkdirSync(path.join(bundle, 'nsis'));
    return { directory, bundle };
}

describe('release artifacts', () => {
    it('rejects a release tag that differs from the app version', () => {
        vi.stubEnv('GITHUB_REF_TYPE', 'tag');
        vi.stubEnv('GITHUB_REF_NAME', 'v99.99.99');
        expect(() => metadata()).toThrow('does not match application version');
    });

    it('does not silently package a platform with missing installers', () => {
        const { bundle, directory } = fixture();
        writeFileSync(path.join(bundle, 'msi', 'app.msi'), 'msi contents');
        expect(() => collect('x86_64-pc-windows-msvc', bundle, path.join(directory, 'out'))).toThrow('Expected exactly one .exe');
    });

    it('preserves installer bytes and produces verifiable checksums and source metadata', () => {
        const { bundle, directory } = fixture();
        const msi = Buffer.from([0, 1, 127, 128, 255]);
        writeFileSync(path.join(bundle, 'msi', 'app.msi'), msi);
        writeFileSync(path.join(bundle, 'nsis', 'app.exe'), 'exe contents');
        const output = collect('x86_64-pc-windows-msvc', bundle, path.join(directory, 'out'));
        const files = readdirSync(output);
        expect(readFileSync(path.join(output, files.find(file => file.endsWith('.msi'))!))).toEqual(msi);
        const manifest = JSON.parse(readFileSync(path.join(output, files.find(file => file.endsWith('_build.json'))!), 'utf8'));
        expect(manifest.target).toBe('x86_64-pc-windows-msvc');
        expect(manifest.commit).toMatch(/^[a-f0-9]{40}$/);
        expect(manifest.artifacts).toHaveLength(2);
        expect(files.every(file => file.startsWith(`Vectored_${manifest.version}_x86_64-pc-windows-msvc`))).toBe(true);
        const checksums = readFileSync(path.join(output, files.find(file => file.endsWith('_SHA256SUMS.txt'))!), 'utf8').trim().split('\n');
        expect(checksums).toHaveLength(4);
        for (const line of checksums) {
            const [expected, filename] = line.split('  ');
            expect(createHash('sha256').update(readFileSync(path.join(output, filename))).digest('hex')).toBe(expected);
        }
    });
});
