import { test, expect } from './browser-fixture.mjs';

test('changes GitHub terminology immediately and remembers the selected mode on reload', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, openPopup, page } = browserApp;
    fixture.html = `<nav aria-label="Repository">
        <a href="/acme/demo/pulls" data-tab-item="pull-requests">Pull requests</a>
        </nav>
        <a class="Button" href="/acme/demo/fork">Fork</a>
        <button id="unlisted">Unlisted fixture control</button>
        <article class="markdown-body"><p>Pull requests</p><p>Fork</p></article>`;
    const popup = await open('github.com', '/acme/demo');
    const mode = popup.getByRole('combobox', { name: '汉化模式' });
    const pulls = page.locator('[data-tab-item="pull-requests"]');
    const fork = page.locator('a[href="/acme/demo/fork"]');

    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(pulls).toHaveText('拉取请求（PR）');
    await expect(fork).toHaveText('复刻（Fork）');
    await expect(mode).toHaveValue('beginner');
    await mode.selectOption('professional');
    await expect(pulls).toHaveText('PR');
    await expect(fork).toHaveText('Fork');

    await page.reload();
    await expect(pulls).toHaveText('PR');
    await expect(fork).toHaveText('Fork');
    await expect(page.locator('#unlisted')).toHaveText('Unlisted fixture control');
    await expect(page.locator('article p')).toHaveText(['Pull requests', 'Fork']);
    const reopened = await openPopup();
    await expect(reopened.getByRole('combobox', { name: '汉化模式' })).toHaveValue('professional');

    const toggle = reopened.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.uncheck();
    await expect(pulls).toHaveText('Pull requests');
    await expect(fork).toHaveText('Fork');
    await expect(pulls).toHaveAttribute('href', '/acme/demo/pulls');
    await toggle.check();
    await expect(pulls).toHaveText('PR');
    await expect(fixture.requests).toEqual([]);
});

test('keeps the selected GitHub vocabulary when upgrading a registered extension', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, openPopup, page, context } = browserApp;
    fixture.html = `<nav aria-label="Repository">
        <a href="/acme/demo/pulls">Pull requests</a>
        </nav>`;
    const popup = await open('github.com', '/acme/demo');
    const navigation = page.getByRole('navigation', { name: 'Repository' });
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(navigation).toHaveText('PR');

    // Model a persistent registration left by the previous version.
    const [worker] = context.serviceWorkers();
    await worker.evaluate(() => chrome.scripting.updateContentScripts([{
        id: 'yoread-github', js: ['vendor/github/locals.js', 'github.js'],
    }]));
    await page.reload();
    await expect(navigation).toHaveText('拉取请求');
    await openPopup();
    await expect(navigation).toHaveText('PR');
    await page.reload();
    await expect(navigation).toHaveText('PR');
});
