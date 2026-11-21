import { spawnSync } from 'node:child_process';
import { expect, test } from './browser-fixture.mjs';

test('the inspection report recognizes a localized GitHub search label', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const location = '#query';
    fixture.html = '<header class="AppHeader"><button id="query" aria-label="Search or jump to, type / to search">Search</button></header>';
    const popup = await open('github.com', '/acme/demo');
    const button = page.locator(location);
    const source = await button.getAttribute('aria-label');
    await popup.locator('#github').check();
    await expect(button).toHaveAttribute('aria-label', '搜索或跳转到，键入 / 搜索');
    const rendered = await button.getAttribute('aria-label');
    const report = spawnSync(process.execPath, ['scripts/github-inspection.mjs'], {
        input: JSON.stringify([{
            pageType: 'repository',
            url: page.url(),
            controls: [{ location, attribute: 'aria-label', source, rendered }],
        }]),
        encoding: 'utf8',
    });

    expect(report.status, report.stdout || report.stderr).toBe(0);
    expect(JSON.parse(report.stdout).pages[0].matched).toBe(1);
});
