import { spawnSync } from 'node:child_process';
import { collectGithubSamples, routePublicGithub } from '../scripts/github-inspection-live.mjs';
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
        <button id="missing-opener" aria-expanded="false">Show menu</button>
        <div hidden><button id="hidden-control" aria-label="Private label">Hidden private text</button></div>
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
        { pageType: 'repository', url: publicUrl, open: '#missing-opener', controls: [
            { location: '#hidden-control', source: 'Download ZIP' },
            { location: '#hidden-control', attribute: 'aria-label', source: 'Open' },
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
        { pageType: 'repository', url: publicUrl, controls: [
            { location: '#hidden-control', source: 'Download ZIP', rendered: '' },
            { location: '#hidden-control', attribute: 'aria-label', source: 'Open', rendered: '' },
        ] },
        { pageType: 'issues', url: dashboardUrl, error: 'HTTP 404' },
    ]);
    const report = spawnSync(process.execPath, ['scripts/github-inspection.mjs'], {
        input: JSON.stringify(samples), encoding: 'utf8',
    });
    expect(report.status, report.stderr).toBe(1);
    expect(JSON.parse(report.stdout)).toMatchObject({
        pages: [{ pageType: 'repository', matched: 1 }],
        findings: expect.arrayContaining([{ source: 'Open', category: 'rule-failed', affectedPages: 1, examples: expect.any(Array) }]),
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
            <div id="menu" hidden><button role="tab">Branches</button><button id="changed-label">Inspect package</button></div>`;
        if (url === '/acme/demo/actions?query=is%3Afailure') return `
            <react-app><h1 data-component="PH_Title">All workflows</h1></react-app>
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
            { location: '#changed-label', source: 'Download ZIP' },
        ] },
        { pageType: 'repository/actions', url: index, controls: [
            { location: '[data-component="PH_Title"]', source: 'All workflows' },
        ] },
        { pageType: 'repository/actions', url: index, follow: {
            location: '#runs a[href]', pathname: /^\/acme\/demo\/actions\/runs\/\d+$/,
        }, controls: [
            { location: '#status', source: 'Status' },
            { location: '#unrecognized', source: 'Failure', fixedSource: true },
            { location: '#logs', source: 'Status', fixedSource: true },
        ] },
        { pageType: 'repository/actions', url: index, follow: {
            location: '#runs article a[href]', pathname: /^\/acme\/demo\/actions\/runs\/\d+$/,
        }, controls: [{ location: '#status', source: 'Status' }] },
    ]);

    expect(samples).toEqual([
        { pageType: 'repository', url: 'https://github.com/acme/demo', controls: [
            { location: '#menu [role="tab"]', source: 'Branches', rendered: '分支' },
            { location: '#changed-label', source: 'Inspect package', rendered: 'Inspect package' },
        ] },
        { pageType: 'repository/actions', url: index, controls: [
            { location: '[data-component="PH_Title"]', source: 'All workflows', rendered: '全部工作流' },
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
    const report = spawnSync(process.execPath, ['scripts/github-inspection.mjs'], {
        input: JSON.stringify(samples), encoding: 'utf8',
    });
    expect(JSON.parse(report.stdout).findings).toContainEqual(expect.objectContaining({
        category: 'unlisted', source: 'Inspect package',
    }));
});

test('fetches approved public detail URLs without following server redirects', async () => {
    const response = { status: () => 302 };
    const route = {
        request: () => ({
            url: () => 'https://github.com/cli/cli/actions/runs/42',
            method: () => 'GET',
            isNavigationRequest: () => true,
        }),
        fetch: async options => {
            expect(options.maxRedirects).toBe(0);
            return response;
        },
        abort: () => 'redirect blocked',
    };
    await expect(routePublicGithub(route)).resolves.toBe('redirect blocked');
    await expect(routePublicGithub({
        ...route,
        fetch: async () => ({ status: () => 200 }),
        fulfill: () => 'approved response served',
    })).resolves.toBe('approved response served');
    await expect(routePublicGithub({
        ...route,
        request: () => ({
            ...route.request(), url: () => 'https://github.com/cli/cli/releases/latest',
        }),
        continue: () => 'release redirect preserved',
    })).resolves.toBe('release redirect preserved');
});

test('localizes a late public Code menu download label without changing archive links or authored text', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = '<main><button id="code">Code</button><div id="code-menu"></div></main>';
    const popup = await open('github.com', '/acme/demo');
    await popup.locator('#github').check();
    await page.evaluate(() => {
        document.querySelector('#code-menu').innerHTML = `
            <ul data-component="ActionList" aria-label="Repository actions">
                <li><a id="archive" href="/acme/demo/archive/refs/heads/trunk.zip">
                    <span data-component="ActionList.Item.Label">Download ZIP</span>
                </a></li>
                <li><a id="other-repo" href="/acme/other/archive/refs/heads/trunk.zip">
                    <span data-component="ActionList.Item.Label">Download ZIP</span>
                </a></li>
            </ul>
            <article><a id="authored" href="/acme/demo/archive/refs/heads/trunk.zip">
                <span data-component="ActionList.Item.Label">Download ZIP</span>
            </a></article>`;
    });

    const archive = page.locator('#archive');
    await expect(archive).toHaveText('下载 ZIP 压缩包');
    await expect(archive).toHaveAttribute('href', '/acme/demo/archive/refs/heads/trunk.zip');
    await expect(page.locator('#other-repo, #authored')).toHaveText(['Download ZIP', 'Download ZIP']);
    await popup.locator('#github').uncheck();
    await expect(archive).toHaveText('Download ZIP');
    expect(fixture.requests).toHaveLength(0);
});
