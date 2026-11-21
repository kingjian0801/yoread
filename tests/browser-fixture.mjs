import { test as base, expect, chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { resolve, join } from 'node:path';

export { expect };

export const test = base.extend({
    githubHostPermission: [true, { option: true }],
    extensionTarget: ['chrome', { option: true }],
    browserApp: async ({ githubHostPermission, extensionTarget }, use, info) => {
        const temp = info.outputPath('browser');
        await mkdir(temp, { recursive: true });
        const key = join(temp, 'key.pem');
        const cert = join(temp, 'cert.pem');
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
            '-subj', '/CN=yoread-browser-fixture', '-keyout', key, '-out', cert], { stdio: 'ignore' });
        const certificate = await readFile(cert);
        const pin = createHash('sha256').update(new X509Certificate(certificate).publicKey
            .export({ type: 'spki', format: 'der' })).digest('base64');

        const extension = join(temp, 'extension');
        if (extensionTarget === 'chrome') {
            await cp(resolve('dist/extension'), extension, { recursive: true });
        } else {
            execFileSync(process.execPath, ['scripts/build-github-only.mjs', extensionTarget, extension]);
        }
        const manifestPath = join(extension, 'manifest.json');
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        const hosts = manifest.host_permissions ?? [];
        // Model the toolbar's temporary access to the generic translation fixture pages.
        if (extensionTarget === 'chrome') hosts.push('https://fixture.test/*', 'http://insecure.test/*');
        // Model an accepted native prompt in the headless browser.
        if (githubHostPermission) hosts.push('https://github.com/*');
        manifest.host_permissions = hosts;
        await writeFile(manifestPath, JSON.stringify(manifest));

        const messages = [];
        const fixture = {
            html: '<main><p id="paragraph">A quiet page for reading.</p></main>',
            requests: messages,
            reply: async ({ texts }) => ({ translations: texts.map(text => '译文 · ' + text) }),
        };
        const server = createServer({ key: await readFile(key), cert: certificate }, async (req, res) => {
            try {
                if (req.headers.host === 'api.deepseek.com') {
                    if (req.url !== '/chat/completions' || req.method !== 'POST') {
                        res.writeHead(404).end();
                        return;
                    }
                    const chunks = [];
                    for await (const chunk of req) chunks.push(chunk);
                    const body = JSON.parse(Buffer.concat(chunks));
                    const { texts } = JSON.parse(body.messages.at(-1).content);
                    const message = { texts, body, headers: req.headers };
                    messages.push(message);
                    const result = await fixture.reply(message);
                    res.writeHead(result.status ?? 200, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
                    return;
                }
                if (!['fixture.test', 'github.com'].includes(req.headers.host)) {
                    res.writeHead(404).end();
                    return;
                }
                const html = typeof fixture.html === 'function' ? fixture.html(req) : fixture.html;
                if (req.url === '/account' && !req.headers.cookie?.includes('fixture-session=sample')) {
                    res.writeHead(403).end('Please sign in');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<!doctype html><meta charset="utf-8">' + html);
            } catch {
                res.writeHead(500).end();
            }
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        const insecure = createHttpServer((_, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<!doctype html><main><p id="paragraph">Reading over HTTP.</p></main>');
        });
        await new Promise(resolve => insecure.listen(0, '127.0.0.1', resolve));
        let context;
        try {
            const rules = ['api.deepseek.com', 'fixture.test', 'github.com'].map(host => `MAP ${host} 127.0.0.1:${port}`);
            rules.push(`MAP insecure.test 127.0.0.1:${insecure.address().port}`);
            context = await chromium.launchPersistentContext(join(temp, 'profile'), {
                channel: 'chromium',
                viewport: { width: 380, height: 660 },
                args: [
                    `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
                    `--host-resolver-rules=${rules.join(', ')}`, '--no-proxy-server',
                    `--ignore-certificate-errors-spki-list=${pin}`, '--disable-background-networking',
                ],
            });
            const [worker = await context.waitForEvent('serviceworker')] = context.serviceWorkers();
            const extensionId = new URL(worker.url()).hostname;
            const [page = await context.newPage()] = context.pages();
            const openPopup = async () => {
                await page.bringToFront();
                const popup = await context.newPage();
                await popup.goto(`chrome-extension://${extensionId}/popup.html`);
                await expect(popup.locator(extensionTarget === 'chrome' ? '#save-key' : '#github')).toBeEnabled();
                return popup;
            };
            const open = async (host = 'fixture.test', path = '/') => {
                const scheme = host === 'insecure.test' ? 'http' : 'https';
                await page.goto(`${scheme}://${host}${path}`);
                return openPopup();
            };
            await use({ fixture, page, open, openPopup, context, extensionId });
        } finally {
            await context?.close();
            server.closeAllConnections();
            insecure.closeAllConnections();
            await Promise.all([server, insecure].map(s => new Promise(resolve => s.close(resolve))));
        }
    },
});

export async function setKey(popup, key = 'test-key') {
    await popup.locator('#key-settings').evaluate(details => { details.open = true; });
    await popup.locator('#key').fill(key);
    await popup.locator('#save-key').click();
    await expect(popup.locator('#settings-status')).toContainText('已保存');
}

export async function translate(popup, first = true) {
    await popup.locator('#translate').click();
    if (first) {
        await expect(popup.locator('#confirm')).toBeVisible();
        await popup.locator('#confirm').click();
    }
}
