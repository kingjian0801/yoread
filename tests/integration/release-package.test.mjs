import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../..', import.meta.url));
const script = join(repository, 'scripts', 'package-release.mjs');

function command(program, args, options = {}) {
    return execFileSync(program, args, { encoding: 'utf8', ...options }).trim();
}

async function fixture(t) {
    const source = await mkdtemp(join(tmpdir(), 'yoread-release-test-'));
    t.after(() => rm(source, { recursive: true, force: true }));
    const archive = join(source, 'source.tar');
    command('git', ['archive', '-o', archive, 'HEAD'], { cwd: repository });
    command('tar', ['-xf', archive], { cwd: source });
    await rm(archive);
    const git = (...args) => command('git', ['-c', 'user.name=Yoread Test', '-c', 'user.email=test@example.com',
        '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd: source });
    git('init', '--quiet');
    git('add', '.');
    git('commit', '--quiet', '-m', 'Candidate fixture');
    const { version } = JSON.parse(await readFile(join(source, 'extension', 'manifest.json'), 'utf8'));
    const output = join(source, 'dist', 'Candidate Files');
    const packageCandidate = (...args) => spawnSync(process.execPath, [script, output, ...args], {
        cwd: source, encoding: 'utf8', timeout: 120_000,
    });
    return { source, git, version, output, packageCandidate };
}

test('rejects a candidate tag with a different version from its committed manifest', async t => {
    const { git, packageCandidate } = await fixture(t);
    git('tag', 'v99.0.0');
    const result = packageCandidate('--tag', 'v99.0.0');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /candidate tag v99\.0\.0 does not match extension version /);
});

test('archives four browser candidates and matching source from the tagged commit', {
    skip: process.platform !== 'darwin' && 'Safari packaging requires macOS and Xcode',
    timeout: 120_000,
}, async t => {
    const { source, git, version, output, packageCandidate } = await fixture(t);
    const tag = `v${version}`;
    git('tag', '-a', tag, '-m', 'Release fixture');
    const sha = git('rev-parse', 'HEAD');
    await writeFile(join(source, 'extension', 'manifest.json'), '{"version":"99.0.0"}');
    await writeFile(join(source, 'extension', 'untracked.txt'), 'Never distributed\n');

    const result = packageCandidate('--tag', tag);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const candidate = JSON.parse(await readFile(join(output, 'candidate.json'), 'utf8'));
    assert.equal(candidate.revision, sha);
    assert.equal(candidate.tag, tag);
    assert.equal(candidate.version, version);
    assert.deepEqual(candidate.browsers.map(entry => entry.browser), ['chrome', 'edge', 'firefox', 'safari']);

    for (const entry of candidate.browsers) {
        const path = join(output, entry.file);
        const resources = entry.browser === 'safari'
            ? 'Yoread.app/Contents/PlugIns/Yoread Extension.appex/Contents/Resources/'
            : '';
        const extract = file => command('unzip', ['-p', path, resources + file]);
        const manifest = JSON.parse(extract('manifest.json'));
        assert.equal(manifest.version, version);
        assert.ok(manifest.icons?.[128]);
        const storeIcon = execFileSync('unzip', ['-p', path, resources + manifest.icons[128]]);
        assert.deepEqual(storeIcon.subarray(0, 8), Buffer.from('89504e470d0a1a0a', 'hex'));
        assert.equal(storeIcon.readUInt32BE(16), 128);
        assert.equal(storeIcon.readUInt32BE(20), 128);
        assert.match(extract('LICENSE'), /GNU GENERAL PUBLIC LICENSE/);
        assert.equal(entry.purpose, entry.browser === 'safari' ? 'local-verification' : 'store-submission');
        assert.equal(entry.signing, entry.browser === 'safari' ? 'ad-hoc' : 'unsigned');
        assert.equal(entry.publication, 'not-submitted');
        assert.equal(entry.publicInstallUrl, null);
        assert.equal(entry.acceptance, 'pending');
        assert.doesNotMatch(command('unzip', ['-Z1', path]), /untracked\.txt/);
    }
    const sourceManifest = command('unzip', ['-p', join(output, candidate.source.file),
        'yoread-source/extension/manifest.json']);
    assert.equal(JSON.parse(sourceManifest).version, version);
    assert.match(command('shasum', ['-a', '256', '-c', 'SHA256SUMS'], { cwd: output }), /candidate\.json: OK/);
});
