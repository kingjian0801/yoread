import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const classifier = fileURLToPath(new URL('../../scripts/pr-check-scope.py', import.meta.url));
const popup = `<!doctype html>
<section id="consent" hidden><h2>确认发送正文</h2></section>
<details class="tools" id="key-settings">
    <summary><span>设置</span></summary>
    <form id="key-form"></form>
</details>
`;

function checkScope(t, changes) {
    const cwd = mkdtempSync(join(tmpdir(), 'yoread-pr-scope-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
    const write = (path, content) => {
        mkdirSync(dirname(join(cwd, path)), { recursive: true });
        writeFileSync(join(cwd, path), content);
    };
    const commit = () => {
        git('add', '-A');
        git('-c', 'user.name=Yoread Tests', '-c', 'user.email=test@example.invalid',
            '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'Fixture');
    };
    git('init', '-q');
    write('extension/popup.html', popup);
    write('extension/popup.css', 'summary { color: black; }\n');
    commit();
    for (const [path, content] of Object.entries(changes)) {
        if (content === null) rmSync(join(cwd, path));
        else write(path, content);
    }
    commit();
    return execFileSync('python3', [classifier], { cwd, encoding: 'utf8' }).trim();
}

test('chooses light checks for popup styling', t => {
    assert.equal(checkScope(t, {
        'extension/popup.css': 'summary:active { color: brown; }\n',
    }), 'light');
});

test('chooses light checks for the local settings disclosure', t => {
    assert.equal(checkScope(t, {
        'extension/popup.html': popup.replace('<span>设置</span>', '<span class="settings-label">翻译设置</span>'),
    }), 'light');
});

test('chooses full checks when the PR touches a critical or shared file', async t => {
    for (const path of ['extension/popup.js', 'extension/background.js', 'package-lock.json', '.github/workflows/ci.yml']) {
        await t.test(path, t => {
            assert.equal(checkScope(t, {
                'extension/popup.css': 'summary:active { color: brown; }\n',
                [path]: 'changed\n',
            }), 'full');
        });
    }
});

test('requires full checks for changes to consent or active disclosure markup', async t => {
    await t.test('consent markup', t => {
        assert.equal(checkScope(t, {
            'extension/popup.html': popup.replace('确认发送正文', '发送'),
        }), 'full');
    });
    await t.test('script in the disclosure', t => {
        assert.equal(checkScope(t, {
            'extension/popup.html': popup.replace('<span>设置</span>', '<script src="popup.js"></script>'),
        }), 'full');
    });
});

test('uses full checks when there is no eligible modification', async t => {
    await t.test('empty diff', t => assert.equal(checkScope(t, {}), 'full'));
    await t.test('deleted stylesheet', t => {
        assert.equal(checkScope(t, { 'extension/popup.css': null }), 'full');
    });
});
