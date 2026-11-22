import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/package-safari.mjs', import.meta.url));
const manifest = {
    manifest_version: 3,
    name: 'Yoread',
    version: '0.1.4',
    description: 'Yoread offline GitHub localization',
    action: { default_popup: 'popup.html' },
    permissions: ['storage', 'scripting'],
    optional_host_permissions: ['https://github.com/*'],
};

async function fixture(t, overrides = {}) {
    const root = await mkdtemp(join(tmpdir(), 'yoread-safari-package-test-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const extension = join(root, 'Extension Files');
    await mkdir(extension);
    await writeFile(join(extension, 'manifest.json'), JSON.stringify({ ...manifest, ...overrides }));
    await writeFile(join(extension, 'popup.html'), '<!doctype html><title>Yoread</title>');
    return { extension, output: join(root, 'Candidate Apps') };
}

function plist(path, key) {
    const result = spawnSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
}

test('rejects a Safari package with required access to a third-party host', async t => {
    const { extension, output } = await fixture(t, { host_permissions: ['https://api.deepseek.com/*'] });
    const result = spawnSync(process.execPath, [script, extension, output], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /optional GitHub access only/);
});

test('rejects an invalid Apple Development team before starting a build', async t => {
    const { extension, output } = await fixture(t);
    const result = spawnSync(process.execPath, [script, extension, output, '--team', 'personal'], {
        encoding: 'utf8', timeout: 20_000,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /--team requires a 10-character Apple Developer Team ID/);
});

test('builds a locally signed macOS host with the same extension version and resources', {
    skip: process.platform !== 'darwin' && 'Xcode requires macOS',
    timeout: 120_000,
}, async t => {
    const { extension, output } = await fixture(t);
    const result = spawnSync(process.execPath, [script, extension, output], { encoding: 'utf8', timeout: 110_000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const app = join(output, 'Yoread.app');
    const plugIn = join(app, 'Contents', 'PlugIns', 'Yoread Extension.appex', 'Contents');
    assert.deepEqual(JSON.parse(await readFile(join(plugIn, 'Resources', 'manifest.json'), 'utf8')), manifest);
    assert.match(await readFile(join(plugIn, 'Resources', 'popup.html'), 'utf8'), /<title>Yoread<\/title>/);
    const hostInfo = join(app, 'Contents', 'Info.plist');
    const extensionInfo = join(plugIn, 'Info.plist');
    assert.equal(plist(hostInfo, 'CFBundleShortVersionString'), manifest.version);
    assert.equal(plist(extensionInfo, 'CFBundleShortVersionString'), manifest.version);
    assert.equal(plist(hostInfo, 'CFBundleIdentifier'), 'io.github.kingjian0801.Yoread');
    assert.equal(plist(extensionInfo, 'CFBundleIdentifier'), 'io.github.kingjian0801.Yoread.Extension');
    assert.equal(plist(extensionInfo, 'NSExtension.NSExtensionPointIdentifier'), 'com.apple.Safari.web-extension');
    const architectures = spawnSync('/usr/bin/lipo', ['-archs', join(app, 'Contents', 'MacOS', 'Yoread')], { encoding: 'utf8' });
    assert.equal(architectures.status, 0, architectures.stderr);
    assert.deepEqual(architectures.stdout.trim().split(/\s+/).sort(), ['arm64', 'x86_64']);
    const signing = spawnSync('/usr/bin/codesign', ['--verify', '--strict', '--deep', app], { encoding: 'utf8' });
    assert.equal(signing.status, 0, signing.stderr);
});
