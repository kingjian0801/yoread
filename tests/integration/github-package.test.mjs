import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../..', import.meta.url));
const source = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));

for (const browser of ['edge', 'firefox', 'safari']) {
    test(`${browser} candidate ships the local GitHub interface and GitHub-only host access`, async t => {
        const temp = await mkdtemp(join(tmpdir(), 'yoread-package-test-'));
        t.after(() => rm(temp, { recursive: true, force: true }));
        const target = join(temp, 'extension');
        await run(process.execPath, ['scripts/build-github-only.mjs', browser, target], { cwd: root });
        const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
        assert.equal(manifest.manifest_version, 3);
        assert.equal(manifest.version, source.version);
        assert.deepEqual(manifest.optional_host_permissions, ['https://github.com/*']);
        assert.deepEqual(manifest.host_permissions ?? [], []);
        assert.deepEqual(manifest.permissions, ['scripting', 'storage']);
        assert.ok(!manifest.content_scripts);
        assert.deepEqual(manifest.background, browser === 'edge'
            ? { service_worker: 'background.js', type: 'module' }
            : { scripts: ['background.js'], type: 'module' });
        if (browser === 'firefox') {
            assert.equal(manifest.browser_specific_settings.gecko.id, 'yoread@kingjian0801.github.io');
        }
        const popup = await readFile(join(target, manifest.action.default_popup), 'utf8');
        assert.match(popup, /GitHub 界面汉化/);
        assert.doesNotMatch(popup, /DeepSeek|API Key/);
        const files = await readdir(target, { recursive: true });
        assert.ok(files.includes('LICENSE'));
        assert.ok(files.includes('LICENSE-MIT-ORIGINAL'));
        assert.ok(files.includes(join('vendor', 'github', 'NOTICE.md')));
        assert.ok(files.includes(join('vendor', 'github', 'locals.js')));
        assert.ok(files.includes('github.js'));
        const dictionary = {};
        runInNewContext(await readFile(join(target, 'github-terms.js'), 'utf8'), dictionary);
        assert.equal(dictionary.yoreadGitHubTerms['Pull requests'].professional, 'PR');
        assert.equal(dictionary.yoreadGitHubPageTerms['repository/pulls']['Pull requests'].professional, 'PR 列表');
        assert.equal(dictionary.yoreadGitHubHeaderLabels['Global navigation menu'], '全局导航菜单');
        assert.ok(!files.includes('provider.js'));
        assert.ok(!files.includes('page.js'));
    });
}
