import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect, setKey, translate } from './browser-fixture.mjs';

const state = (popup, value) => expect(popup.locator('#page-status')).toHaveAttribute('data-state', value);
const lines = requests => requests.flatMap(request => request.texts);
const bodyFixture = '<main><p id="paragraph">A quiet page for reading.</p></main>';

test('keeps the popup controls usable in a narrow window', { tag: '@popup' }, async ({ browserApp }) => {
    const { open, openPopup } = browserApp;
    const setup = await open();
    await setKey(setup);
    await setup.close();
    const popup = await openPopup();
    await popup.setViewportSize({ width: 220, height: 660 });
    await expect(popup.locator('#translate')).toBeEnabled();
    const fitsViewport = () => popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await fitsViewport()).toBe(true);
    const settings = popup.locator('summary');
    await settings.focus();
    await popup.keyboard.press('Space');
    await expect(popup.locator('#key')).toBeVisible();
    expect(await fitsViewport()).toBe(true);
    await settings.click();
    await expect(popup.locator('#key')).toBeHidden();
    await translate(popup);
    await state(popup, 'done');
    await popup.locator('#restore').click();
    await state(popup, 'restored');
});

test('loads the extension, saves, changes, tests and clears a local key', { tag: '@popup' }, async ({ browserApp }) => {
    const { open, openPopup, fixture, page } = browserApp;
    const popup = await open();
    await expect(popup.locator('#translate')).toBeDisabled();
    await setKey(popup, 'bad-key');
    fixture.reply = async ({ headers, texts }) => headers.authorization === 'Bearer bad-key'
        ? { status: 401 } : { translations: texts.map(() => '你好，世界。') };
    await popup.locator('#test-key').click();
    await expect(popup.locator('#settings-status')).toContainText('未通过鉴权');
    await setKey(popup, 'test-key');
    await popup.locator('#test-key').click();
    await expect(popup.locator('#settings-status')).toContainText('连接成功');
    expect(lines(fixture.requests)).toEqual(['Hello, world.', 'Hello, world.']);
    await expect(popup.locator('#key')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText('test-key');
    await popup.reload();
    await expect(popup.locator('#key-state')).toHaveText('已配置');
    const reopened = await openPopup();
    await expect(reopened.locator('#key-state')).toHaveText('已配置');
    await expect(reopened.locator('#key-settings')).not.toHaveAttribute('open', '');
    await expect(reopened.locator('#github')).toBeHidden();
    await reopened.locator('summary').focus();
    await reopened.keyboard.press('Enter');
    await expect(reopened.locator('#github')).toBeVisible();
    await reopened.locator('#clear-key').click();
    await expect(reopened.locator('#translate')).toBeDisabled();
});

test('requires confirmation per page, including login pages and navigation', { tag: '@popup' }, async ({ browserApp }) => {
    const { open, openPopup, fixture, page, context } = browserApp;
    await context.addCookies([{
        name: 'fixture-session', value: 'sample', url: 'https://fixture.test', httpOnly: true, secure: true,
    }]);
    let popup = await open('fixture.test', '/account');
    await setKey(popup);
    const action = () => popup.locator('#translate').click();
    await action();
    await state(popup, 'needs-consent');
    if (process.env.YOREAD_CAPTURE_DIR) {
        await mkdir(process.env.YOREAD_CAPTURE_DIR, { recursive: true });
        await popup.screenshot({ path: resolve(process.env.YOREAD_CAPTURE_DIR, 'popup-consent.png') });
    }
    expect(fixture.requests).toHaveLength(0);
    await popup.locator('#dismiss').click();
    await state(popup, 'idle');
    expect(fixture.requests).toHaveLength(0);
    await action();
    await state(popup, 'needs-consent');
    await popup.close();
    popup = await openPopup();
    expect(fixture.requests).toHaveLength(0);
    await translate(popup);
    await state(popup, 'done');
    await expect(popup.locator('#restore')).toBeFocused();
    await expect(page.locator('#paragraph')).toHaveText('译文 · A quiet page for reading.');
    expect(fixture.requests[0].headers.cookie).toBeUndefined();
    expect(fixture.requests[0].headers.referer).toBeUndefined();
    expect(JSON.stringify(fixture.requests[0].body)).not.toContain('fixture.test');
    await popup.locator('#restore').click();
    await expect(page.locator('#paragraph')).toHaveText('A quiet page for reading.');
    await translate(popup, false);
    await state(popup, 'done');
    await page.reload();
    await action();
    await state(popup, 'needs-consent');
    await page.evaluate(() => history.pushState({}, '', '/next'));
    await popup.locator('#confirm').click();
    await expect(popup.locator('#page-status')).toContainText('页面已变化');
    expect(fixture.requests).toHaveLength(2);
    await translate(popup);
    await state(popup, 'done');
    expect(fixture.requests).toHaveLength(3);
    const anotherTab = await context.newPage();
    await anotherTab.goto('https://fixture.test/next');
    const anotherPopup = await context.newPage();
    await anotherPopup.goto(popup.url());
    await anotherPopup.locator('#translate').click();
    await state(anotherPopup, 'needs-consent');
    expect(fixture.requests).toHaveLength(3);
});

test('translates ordinary HTTP and explains when a page cannot be accessed', async ({ browserApp }) => {
    const { fixture, open, openPopup, page } = browserApp;
    const popup = await open('insecure.test');
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    await setKey(popup);
    await translate(popup);
    await state(popup, 'done');
    await expect(page.locator('#paragraph')).toHaveText('译文 · Reading over HTTP.');
    await page.goto('chrome://version');
    const next = await openPopup();
    await expect(next.locator('#page-status')).toContainText('当前页面不允许扩展读取');
    await expect(next.locator('#translate')).toBeDisabled();
    expect(fixture.requests).toHaveLength(1);
});

test('preserves links, form values and hidden text, then translates new paragraphs', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `<main><h1>Reading room</h1><p>See the <a id="link" href="#note">reference note</a>.</p>
        <table><tr><td>First edition</td></tr></table><pre><code>fetch('/private')</code></pre>
        <input value="secret form value"><output>secret form result</output><p hidden>Invisible hidden text</p>
        <p style="opacity:0">Invisible transparent text</p><div contenteditable="true">Editable note</div>
        <div style="visibility:hidden"><span style="display:contents">Invisible layout text</span></div>
        <p id="note"><img alt="A photograph" src="/sample.png">Appendix</p></main>`;
    const popup = await open();
    await setKey(popup);
    await translate(popup);
    await state(popup, 'done');
    await expect(page.locator('h1')).toHaveText('译文 · Reading room');
    await expect(page.locator('#link')).toHaveAttribute('href', '#note');
    await expect(page.locator('#link')).toHaveText('译文 · reference note');
    await expect(page.locator('code')).toHaveText("fetch('/private')");
    await expect(page.locator('input')).toHaveValue('secret form value');
    await expect(page.locator('img')).toHaveAttribute('src', '/sample.png');
    expect(lines(fixture.requests).join(' ')).not.toMatch(/Invisible|Editable|private|secret/);
    const sent = fixture.requests.length;
    await page.locator('main').evaluate(main => {
        const p = document.createElement('p');
        p.id = 'dynamic';
        p.textContent = 'A new paragraph.';
        main.append(p);
    });
    await expect(popup.locator('#translate')).toHaveText('翻译新增内容');
    await translate(popup, false);
    await expect(page.locator('#dynamic')).toHaveText('译文 · A new paragraph.');
    await state(popup, 'done');
    expect(lines(fixture.requests.slice(sent))).toEqual(['A new paragraph.']);
    await popup.locator('#restore').click();
    await expect(page.locator('#dynamic')).toHaveText('A new paragraph.');
    await expect(page.locator('td')).toHaveText('First edition');
});

test('ignores late responses after Restore and after same-document navigation', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const popup = await open();
    await setKey(popup);
    let complete;
    fixture.reply = () => new Promise(resolve => { complete = resolve; });
    await translate(popup);
    await expect.poll(() => fixture.requests.length).toBe(1);
    await popup.locator('#restore').click();
    await state(popup, 'restored');
    await page.locator('#paragraph').evaluate(node => { node.textContent = 'Website updated its content.'; });
    complete({ translations: ['迟到的译文'] });
    await expect(page.locator('#paragraph')).toHaveText('Website updated its content.');
    await translate(popup, false);
    await expect.poll(() => fixture.requests.length).toBe(2);
    await page.evaluate(() => history.pushState({}, '', '/another'));
    complete({ translations: ['不应出现'] });
    await state(popup, 'idle');
    await expect(page.locator('#paragraph')).toHaveText('Website updated its content.');
    await popup.locator('#translate').click();
    await state(popup, 'needs-consent');
});

test('retries only failed batches and restores all applied translations', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = '<main>' + Array.from({ length: 7 }, (_, i) =>
        `<p id="p${i}">Paragraph number ${i}.</p>`).join('') + '</main>';
    fixture.reply = async ({ texts }) => fixture.requests.length === 2
        ? { status: 503 } : { translations: texts.map(text => '译文 · ' + text) };
    const popup = await open();
    await setKey(popup);
    await translate(popup);
    await state(popup, 'partial');
    await expect(page.locator('#p0')).toHaveText('译文 · Paragraph number 0.');
    await expect(page.locator('#p6')).toHaveText('Paragraph number 6.');
    await translate(popup, false);
    await state(popup, 'done');
    expect(fixture.requests[2].texts).toEqual(fixture.requests[1].texts);
    await popup.locator('#restore').click();
    await expect(page.locator('#p0')).toHaveText('Paragraph number 0.');
    await expect(page.locator('#p6')).toHaveText('Paragraph number 6.');
});

test('recovers malformed batches and counts content below the fold', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const texts = Array.from({ length: 6 }, (_, i) => `Paragraph number ${i}.`);
    fixture.html = '<main>' + texts.map((text, i) =>
        `<p id="p${i}"${i === 5 ? ' style="margin-top:1800px"' : ''}>${text}</p>`).join('') + '</main>';
    let finishLast;
    fixture.reply = ({ texts: batch }) => {
        const result = { translations: batch.map(text => '译文 · ' + text) };
        if (batch.length > 2) return { translations: [] };
        if (batch[0] === texts[5]) return new Promise(resolve => { finishLast = () => resolve(result); });
        return result;
    };
    const popup = await open();
    await setKey(popup);
    await translate(popup);
    await expect(popup.locator('#page-status')).toContainText('5 / 6 段');
    await expect(popup.getByRole('progressbar')).toBeVisible();
    await expect(page.locator('#p5')).toHaveText(texts[5]);
    await expect.poll(() => Boolean(finishLast)).toBe(true);
    finishLast();
    await state(popup, 'done');
    await expect(popup.locator('#page-status')).toContainText('已翻译 6 段');
    await expect(page.locator('#p5')).toHaveText('译文 · ' + texts[5]);
    expect(fixture.requests.map(request => request.texts)).toEqual([
        texts.slice(0, 5), texts.slice(0, 3), texts.slice(0, 2),
        texts.slice(2, 3), texts.slice(3, 5), texts.slice(5),
    ]);
    await popup.locator('#restore').click();
    await expect(page.locator('#p5')).toHaveText(texts[5]);
});

test('retries copied English next to inline code before reporting completion', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const lead = 'An extension with the';
    const sentence = 'permission only obtains access to a tab in response to an explicit user gesture.';
    const tail = 'If the extension is compromised the attacker would need to wait for the user to invoke the extension before obtaining access. And that access only lasts until the tab is navigated or is closed.';
    const original = sentence + ' ' + tail;
    const full = '权限只在用户明确操作时授予标签页访问权限。扩展受到入侵时，攻击者仍须等待用户调用扩展。标签页跳转或关闭时，访问权限即失效。';
    fixture.html = `<main><p id="sample">${lead} <code translate="no">"activeTab"</code> ${original}</p>
        <p id="name">Visual Studio Code</p></main>`;
    fixture.reply = ({ texts }) => ({
        translations: texts.map(text => {
            if (text === original) return fixture.requests.length === 1 ? '权限只在用户明确操作时生效。' + tail : full;
            return text === lead ? '具有以下权限的扩展' : text;
        }),
    });
    const popup = await open();
    await setKey(popup);
    await translate(popup);
    await state(popup, 'done');
    await expect(page.locator('#sample')).toContainText(full);
    await expect(page.locator('code')).toHaveText('"activeTab"');
    await expect(page.locator('#name')).toHaveText('Visual Studio Code');
    expect(fixture.requests.map(request => request.texts)).toEqual([[lead, original, 'Visual Studio Code'], [original]]);
    await popup.locator('#restore').click();
    await expect(popup.locator('#translate')).toBeFocused();
    await expect(page.locator('#sample')).toHaveText(`${lead} "activeTab" ${original}`);
});

test('reports English prose that remains after retry as unfinished', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const original = 'This extension will only read the file when you open it.';
    fixture.html = `<main><p id="sample">${original}</p><p>Good morning.</p></main>`;
    fixture.reply = ({ texts }) => ({ translations: texts.map(text => text === original ? text : '早上好。') });
    const popup = await open();
    await setKey(popup);
    await translate(popup);
    await state(popup, 'partial');
    await expect(popup.locator('#page-status')).toContainText('仍有英文正文');
    await expect(page.locator('#sample')).toHaveText(original);
    expect(fixture.requests.map(request => request.texts)).toEqual([[original, 'Good morning.'], [original]]);
    fixture.reply = () => ({ translations: ['仅在你打开文件时读取。'] });
    await translate(popup, false);
    await state(popup, 'done');
    await expect(page.locator('#sample')).toHaveText('仅在你打开文件时读取。');
    expect(fixture.requests[2].texts).toEqual([original]);
});

test('handles provider balance, rate limits and timeout without losing the original', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const popup = await open();
    await setKey(popup);
    fixture.reply = async () => ({ status: 402 });
    await translate(popup);
    await expect(popup.locator('#page-status')).toContainText('余额不足');
    fixture.reply = async () => ({ status: 429 });
    await translate(popup, false);
    await expect(popup.locator('#page-status')).toContainText('请求过多');
    let complete;
    fixture.reply = () => new Promise(resolve => { complete = resolve; });
    await translate(popup, false);
    await expect(popup.locator('#page-status')).toContainText('响应超时', { timeout: 25_000 });
    complete({ translations: ['逾时译文'] });
    await expect(page.locator('#paragraph')).toHaveText('A quiet page for reading.');
});

test('GitHub localization runs locally and restores independently of body translations', { tag: '@popup' }, async ({ browserApp }) => {
    const { context, fixture, open, openPopup, page } = browserApp;
    fixture.html = req => `<nav aria-label="Repository"><a id="source" href="/acme/demo">Code</a>
        <a id="issues" href="/acme/demo/issues">Issues</a><a id="prs" href="/acme/demo/pulls">Pull requests</a>
        <a data-hovercard-type="user" href="/Code">Code</a></nav>
        <article class="markdown-body">${bodyFixture}<pre><code>const Code = 1;</code></pre></article>
        ${req.url?.includes('/issues/') ? '<span id="route-state" class="State">Open</span>' : ''}
        ${req.url?.includes('/pull/') ? '<span id="route-state" class="State">Merged</span><a id="files" href="/acme/demo/pull/1/files" data-dd-action-name="pull_requests.navigation.files">Files changed</a><table><tr><td class="blob-code">Hidden from translation: source code</td></tr></table>' : ''}`;
    const popup = await open('github.com', '/acme/demo');
    await popup.locator('#github').check();
    await expect(popup.locator('#github-status')).toContainText('已开启');
    await expect(page.locator('#source')).toHaveText('代码');
    await expect(page.locator('#issues')).not.toHaveText('Issues');
    await expect(page.locator('[data-hovercard-type]')).toHaveText('Code');
    expect(fixture.requests).toHaveLength(0);
    await setKey(popup);
    await translate(popup);
    await state(popup, 'done');
    expect(lines(fixture.requests)).toEqual(['A quiet page for reading.']);
    await popup.locator('#restore').click();
    await expect(page.locator('#source')).toHaveText('代码');
    await expect(page.locator('#paragraph')).toHaveText('A quiet page for reading.');
    await translate(popup, false);
    await state(popup, 'done');
    await popup.locator('#github').uncheck();
    await expect(popup.locator('#github-status')).toContainText('已关闭');
    await expect(page.locator('#source')).toHaveText('Code');
    await expect(page.locator('#paragraph')).toHaveText('译文 · A quiet page for reading.');
    await popup.locator('#github').check();
    await expect(popup.locator('#github-status')).toContainText('已开启');
    const [worker] = context.serviceWorkers();
    await worker.evaluate(() => chrome.scripting.unregisterContentScripts({ ids: ['yoread-github'] }));
    await page.reload();
    await expect(page.locator('#source')).toHaveText('Code');
    const reopened = await openPopup();
    await expect(reopened.locator('#github')).toBeChecked();
    await expect(page.locator('#source')).toHaveText('代码');
    await page.goto('https://github.com/acme/demo/issues/1');
    await expect(page.locator('#issues')).not.toHaveText('Issues');
    await expect(page.locator('#route-state')).not.toHaveText('Open');
    await page.goto('https://github.com/acme/demo/pull/1');
    await expect(page.locator('#prs')).not.toHaveText('Pull requests');
    await expect(page.locator('#route-state')).not.toHaveText('Merged');
    await expect(page.locator('#files')).toHaveText('更改的文件');
    const pullPopup = await browserApp.openPopup();
    await translate(pullPopup);
    await state(pullPopup, 'done');
    expect(fixture.requests).toHaveLength(3);
    expect(fixture.requests[2].texts).toEqual(['A quiet page for reading.']);
    await expect(page.locator('.blob-code')).toHaveText('Hidden from translation: source code');
    await pullPopup.locator('#restore').click();
    await expect(page.locator('#files')).toHaveText('更改的文件');
});
