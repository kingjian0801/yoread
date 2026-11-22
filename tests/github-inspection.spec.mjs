import { spawnSync } from 'node:child_process';
import { collectGithubSamples } from '../scripts/github-inspection-live.mjs';
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

test('collects public controls and access failures without exporting page content', async ({ browserApp }) => {
    const { context, openPopup, fixture, page } = browserApp;
    const location = '#query';
    const label = 'Search or jump to, type / to search';
    fixture.html = `<header class="AppHeader"><button id="query" aria-label="${label}">Search</button></header>
        <article><p>Synthetic private text</p><button id="unrelated">Skip reporting this</button></article>`;
    const publicUrl = 'https://github.com/acme/demo';
    const dashboardUrl = 'https://github.com/issues';
    await context.route(dashboardUrl, route => route.fulfill({
        status: 404, contentType: 'text/html', body: '<p>Do not store this error page</p>',
    }));
    const popup = await openPopup();
    const toggle = popup.locator('#github');
    const samples = await collectGithubSamples(page, async enabled => {
        await toggle.setChecked(enabled);
        await expect(popup.locator('#github-status')).toHaveText(enabled ? 'GitHub 汉化已开启。' : 'GitHub 汉化已关闭。');
    }, [
        { pageType: 'repository', url: publicUrl, controls: [{ location, attribute: 'aria-label', source: label }] },
        { pageType: 'issues', url: dashboardUrl, controls: [{ location: 'nav h2', source: 'Views' }] },
    ]);

    expect(samples).toEqual([
        {
            pageType: 'repository', url: publicUrl,
            controls: [{ location, attribute: 'aria-label', source: label, rendered: '搜索或跳转到，键入 / 搜索' }],
        },
        { pageType: 'issues', url: dashboardUrl, error: 'HTTP 404' },
    ]);
    const report = spawnSync(process.execPath, ['scripts/github-inspection.mjs'], {
        input: JSON.stringify(samples), encoding: 'utf8',
    });
    expect(report.status, report.stderr).toBe(1);
    expect(JSON.parse(report.stdout)).toMatchObject({
        pages: [{ pageType: 'repository', matched: 1 }],
        findings: [],
        accessFailures: [{ pageType: 'issues', error: 'HTTP 404' }],
    });
});
