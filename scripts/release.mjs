import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', cwd: root }).trim();

export function metadata() {
    const version = json('package.json').version;
    const cargo = readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf8').split('[package]')[1]?.split(/\n\[/)[0];
    const cargoLock = readFileSync(path.join(root, 'src-tauri/Cargo.lock'), 'utf8').split('[[package]]').find(block => /^name = "vectored"$/m.test(block));
    const versions = [
        version,
        json('package-lock.json').version,
        json('package-lock.json').packages[''].version,
        json('src-tauri/tauri.conf.json').version,
        cargo?.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
        cargoLock?.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    ];
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || versions.some(value => value !== version)) {
        throw new Error(`Release versions must match in package.json, package-lock.json, Cargo.toml, Cargo.lock, and tauri.conf.json: ${versions.join(', ')}`);
    }
    const tag = `v${version}`;
    if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== tag) {
        throw new Error(`Git tag ${process.env.GITHUB_REF_NAME} does not match application version ${tag}`);
    }
    const changes = run('git', ['status', '--porcelain']);
    return { version, tag, commit: run('git', ['rev-parse', 'HEAD']), dirty: Boolean(changes), changes };
}

const formats = {
    'aarch64-apple-darwin': ['.dmg', '.app'],
    'x86_64-apple-darwin': ['.dmg', '.app'],
    'x86_64-pc-windows-msvc': ['.msi', '.exe'],
    'x86_64-unknown-linux-gnu': ['.deb', '.rpm', '.AppImage'],
};

function findBundles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() && !entry.name.endsWith('.app') ? findBundles(filename) : [filename];
    });
}

export function collect(target, bundleDirectory, outputRoot = path.join(root, 'release')) {
    const info = metadata();
    if (!formats[target]) throw new Error(`Unsupported release target: ${target}`);
    const directory = path.resolve(root, bundleDirectory);
    const files = findBundles(directory);
    const selected = formats[target].map(extension => {
        const matches = files.filter(file => file.endsWith(extension));
        if (matches.length !== 1) throw new Error(`Expected exactly one ${extension} bundle in ${directory}; found ${matches.length}`);
        return { source: matches[0], extension };
    });

    const output = path.join(outputRoot, info.tag, target);
    mkdirSync(output, { recursive: true });
    const prefix = `Vectored_${info.version}_${target}`;
    const artifacts = [];
    for (const { source, extension } of selected) {
        const filename = `${prefix}${extension === '.app' ? '.app.zip' : extension}`;
        const destination = path.join(output, filename);
        if (extension === '.app') {
            // Keep executable bits, resource forks, and the .app directory intact.
            rmSync(destination, { force: true });
            execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', source, destination]);
        } else {
            copyFileSync(source, destination);
        }
        const bytes = readFileSync(destination);
        artifacts.push({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    copyFileSync(path.join(root, 'LICENSE'), path.join(output, `${prefix}_LICENSE.txt`));
    writeFileSync(path.join(output, `${prefix}_build.json`), `${JSON.stringify({ ...info, target, artifacts }, null, 2)}\n`);
    const checksummed = [...artifacts.map(artifact => artifact.filename), `${prefix}_LICENSE.txt`, `${prefix}_build.json`];
    writeFileSync(path.join(output, `${prefix}_SHA256SUMS.txt`), checksummed.map(filename => {
        const sha256 = createHash('sha256').update(readFileSync(path.join(output, filename))).digest('hex');
        return `${sha256}  ${filename}\n`;
    }).join(''));
    console.log(`Release artifacts: ${output}`);
    return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.chdir(root);
    const [command, requestedTarget, bundleDirectory] = process.argv.slice(2);
    if (command === 'verify-clean') {
        const info = metadata();
        if (info.dirty) {
            execFileSync('git', ['diff', '--stat'], { cwd: root, stdio: 'inherit' });
            throw new Error(`Release checkout has changes:\n${info.changes}`);
        }
        console.log(`Clean source commit: ${info.commit}`);
    } else if (command === 'metadata') {
        const info = metadata();
        if (process.env.GITHUB_OUTPUT) {
            appendFileSync(process.env.GITHUB_OUTPUT, `version=${info.version}\ntag=${info.tag}\n`);
        }
        console.log(JSON.stringify(info, null, 2));
    } else if (command === 'collect' || command === 'build') {
        const target = requestedTarget || run('rustc', ['-vV']).match(/^host: (.+)$/m)?.[1];
        if (!formats[target]) throw new Error(`Unsupported release target: ${target}`);
        metadata();
        if (command === 'build') {
            const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            for (const script of ['lint', 'test']) {
                execFileSync(npm, ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
            }
            execFileSync(npm, ['run', 'desktop:build', '--', '--target', target, '--ci', '--', '--locked'], {
                stdio: 'inherit', shell: process.platform === 'win32',
            });
        }
        const defaultDirectory = `src-tauri/target/${target}/release/bundle`;
        collect(target, bundleDirectory || defaultDirectory);
    } else {
        throw new Error('Usage: node scripts/release.mjs metadata | verify-clean | build [target] | collect <target> [bundle-directory]');
    }
}
