import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('the GitHub-only popup recovers when its background does not answer the first read', async () => {
    const script = await readFile(new URL('../../packages/github-only/popup.js', import.meta.url), 'utf8');
    const control = () => ({ disabled: true, addEventListener() {} });
    const toggle = control();
    const mode = control();
    const status = { textContent: '' };
    const elements = { '#github': toggle, '#github-mode': mode, '#github-status': status };
    let backgroundReady = false;
    const runtime = {
        async sendMessage(message) {
            assert.equal(message.type, 'settings.get');
            if (!backgroundReady) return undefined;
            return { ok: true, github: true, githubMode: 'professional' };
        },
    };
    runInNewContext(script, {
        document: { querySelector: id => elements[id] },
        browser: { runtime },
        setTimeout(callback) {
            assert.equal(toggle.disabled, true);
            backgroundReady = true;
            callback();
        },
    });
    await new Promise(setImmediate);
    assert.equal(toggle.disabled, false);
    assert.equal(toggle.checked, true);
    assert.equal(mode.value, 'professional');
    assert.equal(status.textContent, '');
});
