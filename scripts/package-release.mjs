import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const licenses = ['LICENSE', 'LICENSE-MIT-ORIGINAL', 'vendor/github/NOTICE.md'];
const extensionFiles = [
    'manifest.json', 'background.js', 'github-settings.js', 'github-terms.js', 'github.js',
    'popup.css', 'popup.html', 'popup.js', 'vendor/github/locals.js', ...licenses,
];
const chromeFiles = [...extensionFiles, 'page.js', 'provider.js', 'translation-rules.js'];
const channels = {
    chrome: 'Chrome Web Store',
    edge: 'Microsoft Edge Add-ons',
    firefox: 'Mozilla Add-ons',
    safari: 'Mac App Store',
};

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function candidateRevision(tag) {
    const revision = git('rev-parse', 'HEAD');
    const { version } = JSON.parse(git('show', `${revision}:extension/manifest.json`));
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Extension version must use major.minor.patch.');
    if (tag === undefined) return { revision, version };
    if (tag !== `v${version}`) throw new Error(`The candidate tag ${tag} does not match extension version ${version}.`);
    let taggedRevision;
    try {
        taggedRevision = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
    } catch {
        throw new Error(`The candidate tag ${tag} does not exist locally.`);
    }
    if (taggedRevision !== revision) throw new Error(`The candidate tag ${tag} does not point to HEAD.`);
    return { revision, version };
}

async function filesAt(directory, prefix = '') {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const relative = prefix + entry.name;
        if (entry.isDirectory()) {
            files.push(...await filesAt(join(directory, entry.name), relative + '/'));
        } else if (entry.isFile()) {
            files.push(relative);
        } else {
            throw new Error(`Unexpected extension resource type: ${relative}`);
        }
    }
    return files.sort();
}

async function verifyExtension(directory, allowedFiles, version, licenseHashes) {
    const actual = await filesAt(directory);
    const expected = [...allowedFiles].sort();
    if (actual.join('\n') !== expected.join('\n')) {
        const unexpected = actual.filter(file => !expected.includes(file));
        const missing = expected.filter(file => !actual.includes(file));
        throw new Error(`Invalid extension package files. Unexpected: ${unexpected.join(', ')}. Missing: ${missing.join(', ')}.`);
    }
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    if (manifest.version !== version) throw new Error(`Expected extension version ${version} in ${directory}.`);
    for (const [file, expectedHash] of Object.entries(licenseHashes)) {
        if (await sha256(join(directory, file)) !== expectedHash) throw new Error(`License differs from source: ${file}.`);
    }
}

async function sha256(file) {
    return createHash('sha256').update(await readFile(file)).digest('hex');
}

function run(program, args, cwd) {
    execFileSync(program, args, { cwd, stdio: 'inherit' });
}

async function buildCandidate(snapshot, artifacts, { revision, version, tag, team }) {
    const licenseSources = licenses.map(file => file.startsWith('vendor/') ? `extension/${file}` : file);
    const licenseHashes = Object.fromEntries(await Promise.all(licenses.map(async (file, index) =>
        [file, await sha256(join(snapshot, licenseSources[index]))])));
    const sourceFile = `yoread-${version}-source.zip`;
    git('archive', '--format=zip', '--prefix=yoread-source/', '-o', join(artifacts, sourceFile), revision);
    const browsers = [];
    for (const [browser, channel] of Object.entries(channels)) {
        const chrome = browser === 'chrome';
        const safari = browser === 'safari';
        const extension = join(snapshot, 'dist', chrome ? 'extension' : browser);
        run(process.execPath, chrome ? ['scripts/build.mjs'] : ['scripts/build-github-only.mjs', browser], snapshot);
        const allowedFiles = chrome ? chromeFiles : extensionFiles;
        await verifyExtension(extension, allowedFiles, version, licenseHashes);

        const suffix = browser === 'firefox' ? 'xpi' : 'zip';
        const file = `yoread-${version}-${browser}.${suffix}`;
        const destination = join(artifacts, file);
        if (safari) {
            const appDirectory = join(snapshot, 'dist', 'safari-app');
            const args = ['scripts/package-safari.mjs', extension, appDirectory];
            if (team) args.push('--team', team);
            run(process.execPath, args, snapshot);
            const app = join(appDirectory, 'Yoread.app');
            const host = join(app, 'Contents');
            const appex = join(host, 'PlugIns', 'Yoread Extension.appex', 'Contents');
            await verifyExtension(join(appex, 'Resources'), extensionFiles, version, licenseHashes);
            for (const directory of [host, appex]) {
                const actualVersion = execFileSync('/usr/bin/plutil', [
                    '-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', join(directory, 'Info.plist'),
                ], { encoding: 'utf8' }).trim();
                if (actualVersion !== version) throw new Error(`Expected Safari bundle version ${version} in ${directory}.`);
            }
            run('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--keepParent', app, destination]);
        } else {
            run('zip', ['-q', '-X', destination, ...allowedFiles], extension);
        }
        run('unzip', ['-tq', destination]);
        browsers.push({
            browser, channel, file, sha256: await sha256(destination),
            purpose: safari ? 'local-verification' : 'store-submission',
            signing: safari ? (team ? 'apple-development' : 'ad-hoc') : 'unsigned',
            publication: 'not-submitted',
            acceptance: 'pending',
            publicInstallUrl: null,
        });
    }
    const source = {
        file: sourceFile, sha256: await sha256(join(artifacts, sourceFile)),
        licenses: licenseSources.map((path, index) => ({ path, sha256: licenseHashes[licenses[index]] })),
    };
    const record = { version, revision, tag: tag ?? null, source, browsers };
    await writeFile(join(artifacts, 'candidate.json'), JSON.stringify(record, null, 2) + '\n');
    const checksums = [...browsers, source, { file: 'candidate.json', sha256: await sha256(join(artifacts, 'candidate.json')) }];
    await writeFile(join(artifacts, 'SHA256SUMS'), checksums.map(({ sha256, file }) => `${sha256}  ${file}\n`).join(''));
}

try {
    const { positionals, values: { tag, team } } = parseArgs({ allowPositionals: true, options: {
        tag: { type: 'string' },
        team: { type: 'string' },
    } });
    if (positionals.length !== 1) {
        throw new Error('Usage: node scripts/package-release.mjs <output-directory> [--tag vX.Y.Z] [--team TEAM_ID]');
    }
    if (team !== undefined && !/^[A-Z0-9]{10}$/.test(team)) {
        throw new Error('--team requires a 10-character Apple Developer Team ID');
    }
    const candidate = candidateRevision(tag);
    if (process.platform !== 'darwin') throw new Error('Four-browser packaging requires macOS and Xcode.');
    const output = resolve(positionals[0]);
    if (lstatSync(output, { throwIfNoEntry: false })) throw new Error(`Candidate already exists: ${output}`);
    await mkdir(dirname(output), { recursive: true });
    const staging = await mkdtemp(join(dirname(output), '.yoread-release-'));
    try {
        const snapshot = join(staging, 'snapshot');
        const artifacts = join(staging, 'artifacts');
        const archive = join(staging, 'snapshot.tar');
        await mkdir(snapshot);
        await mkdir(artifacts);
        git('archive', '--format=tar', '-o', archive, candidate.revision);
        run('tar', ['-xf', archive], snapshot);
        await buildCandidate(snapshot, artifacts, { ...candidate, tag, team });
        await rename(artifacts, output);
    } finally {
        await rm(staging, { recursive: true, force: true });
    }
    console.log(`Yoread ${candidate.version} (${candidate.revision}): ${output}`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
