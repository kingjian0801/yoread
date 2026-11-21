import { test, expect } from './browser-fixture.mjs';

test('prefers the curated terminology exception on the GitHub pull request list', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = '<nav aria-label="Repository"><a href="/acme/demo/pulls">Pull requests</a></nav>';
    const popup = await open('github.com', '/acme/demo');
    const link = page.locator('nav a');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(link).toHaveText('PR');

    await page.goto('https://github.com/acme/demo/pulls');
    await expect(link).toHaveText('PR 列表');
    await expect(link).toHaveAttribute('href', '/acme/demo/pulls');
    await page.goBack();
    await expect(link).toHaveText('PR');
});
