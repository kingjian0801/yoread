import { expect, setKey, test, translate } from './browser-fixture.mjs';

const shortcut = 'Control+Shift+Y';
const repo = 'https://github.com/acme/demo';
const markup = `
    <nav aria-label="Repository navigation"><a href="/acme/demo/pulls">Pull requests</a></nav>
    <div style="height:750px"></div>
    <details><summary>Discussion</summary>
        <label>Comment draft <textarea></textarea></label>
    </details>
    <div style="height:750px"></div>
`;

test('switches the current tab to original and back in place', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page, context } = browserApp;
    fixture.html = markup;
    const popup = await open('github.com', '/acme/demo');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    const nav = page.getByRole('navigation');
    await expect(nav).toHaveText('拉取请求（PR）');

    const secondTab = await context.newPage();
    await secondTab.goto(repo);
    await expect(secondTab.getByRole('navigation')).toHaveText('拉取请求（PR）');

    await page.bringToFront();
    await page.locator('summary').click();
    await page.getByRole('textbox', { name: 'Comment draft' }).fill('My unfinished review');
    await page.locator('summary').focus();
    const position = await page.evaluate(() => scrollY);
    expect(position).toBeGreaterThan(0);
    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('Pull requests');
    await expect(secondTab.getByRole('navigation')).toHaveText('拉取请求（PR）');
    await expect(page.getByRole('textbox', { name: 'Comment draft' })).toHaveValue('My unfinished review');
    await expect(page.locator('details')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => scrollY)).toBe(position);

    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('拉取请求（PR）');
    await expect(page.locator('summary')).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Comment draft' })).toHaveValue('My unfinished review');
});

test('keeps editor and already handled keyboard chords available to the page', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = markup + `
        <input aria-label="Issue title">
        <div contenteditable="true" tabindex="0">Draft body</div>
        <div role="searchbox" tabindex="0">Search query</div>
    `;
    const popup = await open('github.com', '/acme/demo');
    const nav = page.getByRole('navigation');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(nav).toHaveText('拉取请求（PR）');
    await page.locator('summary').click();
    for (const field of ['input', 'textarea', '[contenteditable]', '[role="searchbox"]']) {
        await page.locator(field).press(shortcut);
        await expect(nav).toHaveText('拉取请求（PR）');
    }

    const intercepted = await page.evaluate(() => {
        const chord = { code: 'KeyY', ctrlKey: true, shiftKey: true, cancelable: true, bubbles: true };
        const dispatch = changes => document.body.dispatchEvent(new KeyboardEvent('keydown', { ...chord, ...changes }));
        const composing = dispatch({ isComposing: true });
        const repeated = dispatch({ repeat: true });
        const differentModifiers = dispatch({ altKey: true });
        const claimed = new KeyboardEvent('keydown', chord);
        document.body.addEventListener('keydown', event => event.preventDefault(), { once: true });
        document.body.dispatchEvent(claimed);
        return { composing, repeated, differentModifiers };
    });
    expect(intercepted).toEqual({ composing: true, repeated: true, differentModifiers: true });
    await expect(nav).toHaveText('拉取请求（PR）');
});

test('resumes using the latest mode and keeps body translation separate', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = markup + '<article class="markdown-body"><p>A quiet page for reading.</p></article>';
    const popup = await open('github.com', '/acme/demo');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    const nav = page.getByRole('navigation');
    const paragraph = page.locator('article p');
    await toggle.check();
    await expect(nav).toHaveText('拉取请求（PR）');
    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('Pull requests');
    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(popup.locator('#github-status')).toHaveText('已切换到专业档。');
    const fork = page.locator('#late-fork');
    await page.evaluate(() => {
        const button = document.createElement('button');
        button.id = 'late-fork';
        button.textContent = 'New pull request';
        document.body.append(button);
    });
    await setKey(popup);
    await translate(popup);
    await expect(paragraph).toHaveText('译文 · A quiet page for reading.');
    expect(fixture.requests.flatMap(request => request.texts)).toEqual(['A quiet page for reading.']);
    await expect(nav).toHaveText('Pull requests');
    await expect(fork).toHaveText('New pull request');

    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('PR');
    await expect(fork).toHaveText('新建 PR');
    await expect(paragraph).toHaveText('译文 · A quiet page for reading.');
    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('Pull requests');
    await toggle.uncheck();
    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('Pull requests');
    await toggle.check();
    await expect(nav).toHaveText('PR');

    await page.keyboard.press(shortcut);
    await expect(nav).toHaveText('Pull requests');
    await page.evaluate(() => history.pushState(null, '', '/acme/demo/pulls'));
    await expect(nav).toHaveText('PR 列表');
});
