import { expect, test } from './browser-fixture.mjs';

test.use({ extensionTarget: 'edge' });

test('GitHub-only candidate localizes offline after site access and restores', async ({ browserApp }) => {
    const { context, fixture, open, page } = browserApp;
    fixture.html = `<nav aria-label="Repository">
        <a data-tab-item="code" href="/acme/demo">Code</a>
        <a data-tab-item="pull-requests" href="/acme/demo/pulls">Pull requests</a>
    </nav><article class="markdown-body"><p>Code</p></article>`;
    const popup = await open('github.com', '/acme/demo');
    const code = page.locator('[data-tab-item="code"]');
    const pullRequests = page.locator('[data-tab-item="pull-requests"]');
    const toggle = popup.getByLabel('启用汉化');
    const status = popup.getByRole('status');

    await expect(code).toHaveText('Code');
    await expect(popup.locator('#key')).toHaveCount(0);
    await expect(toggle).not.toBeChecked();
    await context.setOffline(true);
    await toggle.check();
    await expect(status).toContainText('已开启');
    await expect(code).toHaveText('代码');
    await expect(pullRequests).toHaveText('拉取请求（PR）');
    await popup.getByLabel('汉化模式').selectOption('professional');
    await expect(pullRequests).toHaveText('PR');
    await expect(page.locator('article')).toHaveText('Code');
    await toggle.uncheck();
    await expect(status).toContainText('已关闭');
    await expect(code).toHaveText('Code');
    expect(fixture.requests).toHaveLength(0);
});
