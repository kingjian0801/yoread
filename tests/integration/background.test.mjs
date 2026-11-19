import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { DEEPSEEK_MODEL, DEEPSEEK_URL } from '../../extension/provider.js';

const popup = { url: 'chrome-extension://fixture/popup.html' };
const content = { frameId: 0, documentId: 'document-1', tab: { id: 9 }, url: 'https://example.test/article' };
const key = 'synthetic-api-key';
let instance = 0;

const completion = translations => ({
    choices: [{ message: { content: JSON.stringify({ translations }) } }],
});

async function startWorker(t) {
    const requests = [];
    const tabMessages = [];
    const injections = [];
    const stored = {};
    const fixture = {
        frame: { documentId: content.documentId, url: content.url },
        reply: () => ({ body: completion(['测试译文']) }),
    };
    const server = createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        requests.push({ method: req.method, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
        const { status = 200, body } = fixture.reply();
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => {
        server.closeAllConnections();
        return new Promise(resolve => server.close(resolve));
    });
    const localEndpoint = `http://127.0.0.1:${server.address().port}/chat/completions`;
    const fetchFromNetwork = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', (url, options) => {
        assert.equal(url, DEEPSEEK_URL);
        return fetchFromNetwork(localEndpoint, options);
    });

    let onMessage;
    const noopEvent = { addListener() {} };
    globalThis.chrome = {
        runtime: {
            getURL: path => 'chrome-extension://fixture/' + path,
            onMessage: { addListener(listener) { onMessage = listener; } },
            onInstalled: noopEvent,
            onStartup: noopEvent,
        },
        storage: {
            local: {
                async setAccessLevel() {},
                async get(keys) {
                    const list = typeof keys === 'string' ? [keys] : keys;
                    return Object.fromEntries(list.map(item => [item, stored[item]]));
                },
                async set(items) { Object.assign(stored, items); },
                async remove(item) { delete stored[item]; },
            },
        },
        permissions: { onRemoved: noopEvent },
        webNavigation: { async getFrame() { return fixture.frame; } },
        scripting: {
            async executeScript(details) {
                injections.push(details);
                return [{ documentId: fixture.frame.documentId }];
            },
        },
        tabs: {
            async sendMessage(tabId, message, options) {
                tabMessages.push({ tabId, message, options });
                return { ok: true, state: 'working' };
            },
        },
    };
    t.after(() => { delete globalThis.chrome; });
    await import(`../../extension/background.js?fixture=${++instance}`);

    function send(message, sender = popup) {
        return new Promise(resolve => {
            assert.equal(onMessage(message, sender, resolve), true);
        });
    }

    return { fixture, requests, tabMessages, injections, send };
}

const textsSent = request => JSON.parse(request.body.messages.at(-1).content).texts;
const translation = texts => ({ type: 'provider.translate', url: content.url, texts });

test('saves a key, tests with fixed text and stops sending after clearing it', async t => {
    const { requests, send } = await startWorker(t);
    assert.deepEqual(await send({ type: 'settings.save', key }, content), { ok: false, code: 'unsupported' });
    assert.deepEqual(await send({ type: 'settings.save', key: ` ${key} ` }), { ok: true });
    assert.equal(requests.length, 0);
    assert.deepEqual(await send({ type: 'settings.get' }), { ok: true, configured: true, github: false });
    assert.deepEqual(await send({ type: 'settings.test' }), { ok: true });
    assert.deepEqual(textsSent(requests[0]), ['Hello, world.']);
    assert.equal(requests[0].headers.authorization, `Bearer ${key}`);
    assert.deepEqual(await send({ type: 'settings.clear' }), { ok: true });
    assert.deepEqual(await send({ type: 'settings.test' }), { ok: false, code: 'missing-key' });
    assert.equal(requests.length, 1);
});

test('translates through the worker, preserving order and withholding the page address and site headers', async t => {
    const { fixture, requests, send } = await startWorker(t);
    fixture.reply = () => ({ body: completion(['一句', '两句']) });
    await send({ type: 'settings.save', key });
    assert.deepEqual(await send(translation(['One sentence', 'Two sentences']), content),
        { ok: true, translations: ['一句', '两句'] });
    assert.equal(requests.length, 1);
    const [request] = requests;
    assert.equal(request.method, 'POST');
    assert.equal(request.body.model, DEEPSEEK_MODEL);
    assert.deepEqual(textsSent(request), ['One sentence', 'Two sentences']);
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers.referer, undefined);
    assert.equal(JSON.stringify(request.body).includes(content.url), false);
});

test('rejects stale documents, subframes and over-limit batches before the API call', async t => {
    const { fixture, requests, send } = await startWorker(t);
    await send({ type: 'settings.save', key });
    const delivery = translation(['A sentence.']);
    assert.deepEqual(await send(delivery, { ...content, frameId: 1 }), { ok: false, code: 'unsupported' });
    fixture.frame.documentId = 'document-2';
    assert.deepEqual(await send(delivery, content), { ok: false, code: 'page-changed' });
    fixture.frame.documentId = content.documentId;
    for (const batch of [[], [' '], Array.from({ length: 6 }, () => 'word'), ['x'.repeat(4001)]]) {
        assert.deepEqual(await send(translation(batch), content), { ok: false, code: 'response' });
    }
    assert.equal(requests.length, 0);
});

test('routes a valid confirmation to the same document and refuses an old confirmation after navigation', async t => {
    const { fixture, tabMessages, injections, send } = await startWorker(t);
    const confirm = { type: 'page.confirm', tabId: content.tab.id, documentId: content.documentId, token: 'confirmation' };
    assert.deepEqual(await send(confirm), { ok: true, state: 'working', documentId: content.documentId });
    assert.deepEqual(injections, [{ target: { tabId: content.tab.id }, files: ['translation-rules.js', 'page.js'] }]);
    assert.deepEqual(tabMessages, [{
        tabId: content.tab.id, message: { type: 'content.confirm', token: confirm.token },
        options: { documentId: content.documentId },
    }]);
    fixture.frame.documentId = 'document-2';
    assert.deepEqual(await send(confirm), { ok: false, code: 'page-changed' });
    assert.equal(tabMessages.length, 1);
});

test('returns typed errors for HTTP failures and invalid replies over the mock API', async t => {
    const { fixture, requests, send } = await startWorker(t);
    await send({ type: 'settings.save', key });
    for (const [status, code] of [[401, 'unauthorized'], [402, 'balance'], [429, 'rate-limit']]) {
        fixture.reply = () => ({ status, body: { error: 'fixture' } });
        assert.deepEqual(await send(translation(['A sentence.']), content), { ok: false, code });
    }
    fixture.reply = () => ({ body: completion([]) });
    assert.deepEqual(await send(translation(['A sentence.']), content), { ok: false, code: 'response' });
    fixture.reply = () => ({ body: completion(['一个句子。']) });
    assert.deepEqual(await send(translation(['A sentence.']), content), { ok: true, translations: ['一个句子。'] });
    assert.equal(requests.length, 5);
});

test('forwards the request deadline to the network and reports an expired request', async t => {
    const { fixture, requests, send } = await startWorker(t);
    const deadline = new AbortController();
    t.mock.method(AbortSignal, 'timeout', () => deadline.signal);
    fixture.reply = () => {
        deadline.abort();
        return { body: completion(['太迟的译文']) };
    };
    await send({ type: 'settings.save', key });
    assert.deepEqual(await send(translation(['A sentence.']), content), { ok: false, code: 'timeout' });
    assert.equal(requests.length, 1);
});
