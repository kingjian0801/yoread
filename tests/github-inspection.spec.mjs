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
        <button id="mixed-control">Open <span class="markdown-body">Private nested content</span></button>
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
        { pageType: 'repository', url: publicUrl, controls: [
            { location, attribute: 'aria-label', source: label },
            { location: '#mixed-control', source: 'Open' },
        ] },
        { pageType: 'issues', url: dashboardUrl, controls: [{ location: 'nav h2', source: 'Views' }] },
    ]);

    expect(samples).toEqual([
        {
            pageType: 'repository', url: publicUrl,
            controls: [
                { location, attribute: 'aria-label', source: label, rendered: '搜索或跳转到，键入 / 搜索' },
                { location: '#mixed-control', source: 'Open', rendered: '' },
            ],
        },
        { pageType: 'issues', url: dashboardUrl, error: 'HTTP 404' },
    ]);
    const report = spawnSync(process.execPath, ['scripts/github-inspection.mjs'], {
        input: JSON.stringify(samples), encoding: 'utf8',
    });
    expect(report.status, report.stderr).toBe(1);
    expect(JSON.parse(report.stdout)).toMatchObject({
        pages: [{ pageType: 'repository', matched: 1 }],
        findings: [{ source: 'Open', category: 'rule-failed' }],
        accessFailures: [{ pageType: 'issues', error: 'HTTP 404' }],
    });
});

test('opens public controls and follows only approved same-repository detail links', async ({ browserApp }) => {
    const { openPopup, fixture, page } = browserApp;
    const visits = [];
    const index = 'https://github.com/acme/demo/actions?query=is%3Afailure';
    const detail = 'https://github.com/acme/demo/actions/runs/42';
    fixture.html = ({ url }) => {
        visits.push(url);
        if (url === '/acme/demo') return `
            <button id="open-menu" aria-expanded="false" onclick="
                this.setAttribute('aria-expanded','true');
                document.querySelector('#menu').hidden = false;
            ">Choose reference</button>
            <div id="menu" hidden><button role="tab">Branches</button></div>`;
        if (url === '/acme/demo/actions?query=is%3Afailure') return `
            <div id="runs">
                <a href="https://example.org/acme/demo/actions/runs/1">Outside GitHub</a>
                <a href="/acme/other/actions/runs/2">Another repository</a>
                <a href="/acme/demo/actions/runs/3?secret=private-value">Unapproved query</a>
                <article><a href="/acme/demo/actions/runs/4">Link in user content</a></article>
                <a href="/acme/demo/actions/runs/42">Public run name</a>
            </div>`;
        if (url === '/acme/demo/actions/runs/42') return `
            <section class="actions-workflow-stats"><div><div><span id="status">Status</span></div></div></section>
            <span id="unrecognized">Dynamic private name</span>
            <pre><span id="logs">Sensitive log content</span></pre>`;
        return '';
    };
    const popup = await openPopup();
    const samples = await collectGithubSamples(page, async enabled => {
        await popup.locator('#github').setChecked(enabled);
        await expect(popup.locator('#github-status')).toHaveText(enabled ? 'GitHub 汉化已开启。' : 'GitHub 汉化已关闭。');
    }, [
        { pageType: 'repository', url: 'https://github.com/acme/demo', open: '#open-menu', controls: [
            { location: '#menu [role="tab"]', source: 'Branches' },
        ] },
        { pageType: 'repository/actions', url: index, follow: {
            location: '#runs a[href]', pathname: /^\/acme\/demo\/actions\/runs\/\d+$/,
        }, exactSource: true, controls: [
            { location: '#status', source: 'Status' },
            { location: '#unrecognized', source: 'Failure' },
            { location: '#logs', source: 'Status' },
        ] },
        { pageType: 'repository/actions', url: index, follow: {
            location: '#runs article a[href]', pathname: /^\/acme\/demo\/actions\/runs\/\d+$/,
        }, controls: [{ location: '#status', source: 'Status' }] },
    ]);

    expect(samples).toEqual([
        { pageType: 'repository', url: 'https://github.com/acme/demo', controls: [
            { location: '#menu [role="tab"]', source: 'Branches', rendered: '分支' },
        ] },
        { pageType: 'repository/actions', url: detail, controls: [
            { location: '#status', source: 'Status', rendered: '状态' },
            { location: '#unrecognized', source: 'Failure', rendered: '' },
            { location: '#logs', source: 'Status', rendered: '' },
        ] },
        { pageType: 'repository/actions', url: index, error: 'Expected public link not found' },
    ]);
    expect(visits.filter(url => url.startsWith('/acme/'))).toEqual([
        '/acme/demo', '/acme/demo/actions?query=is%3Afailure', '/acme/demo/actions/runs/42',
        '/acme/demo/actions?query=is%3Afailure',
    ]);
    expect(JSON.stringify(samples)).not.toMatch(/private-value|Dynamic private name|Sensitive log content|Public run name/);
});
