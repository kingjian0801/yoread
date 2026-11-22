/* SPDX-License-Identifier: GPL-3.0-or-later */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, expect } from '@playwright/test';

const github = 'https://github.com';
const timeout = 5000;
const control = (location, source, attribute) => ({ location, source, ...(attribute && { attribute }) });
const publicSamples = [
    {
        pageType: 'repository', path: '/cli/cli',
        controls: [
            control('nav a[data-tab-item="code"]', 'Code'),
            control('button[data-analytics-event*="searchbar_input_global_navbar"], button[data-target="qbsearch-input.inputButton"]',
                'Search or jump to, type / to search', 'aria-label'),
        ],
    },
    {
        pageType: 'repository/issues', path: '/cli/cli/issues',
        controls: [
            control('react-app[app-name="repo"] [data-testid="header-title"]', 'Issues'),
            control('#issues-index-filter[aria-label]', 'Search issues', 'aria-label'),
        ],
    },
    {
        pageType: 'repository/pulls', path: '/cli/cli/pulls',
        controls: [
            control('react-app[app-name="repo"] [data-testid="header-title"]', 'Pull requests'),
            control('#repo-pulls-dashboard-filter[aria-label]', 'Search pull requests', 'aria-label'),
        ],
    },
    {
        pageType: 'repository/actions', path: '/cli/cli/actions?query=is%3Afailure',
        controls: [control('react-app [data-component="PH_Title"]', 'All workflows')],
    },
    {
        pageType: 'repository/releases', path: '/cli/cli/releases/latest',
        open: 'details-toggle summary[data-target="details-toggle.summaryTarget"]',
        controls: [
            control('nav[aria-label="Breadcrumb"] .breadcrumb-item > a[href$="/releases"]', 'Releases'),
            control('details-toggle a.wb-break-all[href$=".zip"][href*="/archive/refs/tags/"] > .text-bold', 'Source code'),
        ],
    },
    {
        pageType: 'repository/milestones', path: '/nodejs/node/milestones',
        controls: [control('[data-testid="closed-milestone-tab"] > div', 'Closed')],
    },
    {
        pageType: 'issues', path: '/issues',
        controls: [control('main nav a[href="/issues/created"], aside nav a[href="/issues/created"]', 'Created')],
    },
].map(({ path, ...sample }) => ({ ...sample, url: github + path }));

async function readControls(page, controls) {
    return page.evaluate(controls => controls.map(({ location, attribute }) => {
        const target = document.querySelector(location);
        if (!target || target.closest(
            'article, .markdown-body, pre, code, [contenteditable], [role="log"], form:not([role="search"]) textarea',
        )) return '';
        const value = attribute ? target.getAttribute(attribute) : target.innerText;
        return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 260);
    }), controls);
}

export async function collectGithubSamples(page, setLocalization, samples = publicSamples) {
    const results = [];
    for (const { pageType, url, controls, open } of samples) {
        const result = { pageType, url };
        let response;
        try {
            response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        } catch {
            results.push({ ...result, error: 'Navigation failed' });
            continue;
        }
        if (!response?.ok()) {
            results.push({ ...result, error: response ? `HTTP ${response.status()}` : 'No navigation response' });
            continue;
        }
        const location = new URL(page.url());
        if (location.origin !== github || /^\/(?:login|session|sessions)(?:\/|$)/.test(location.pathname)) {
            results.push({ ...result, error: 'Page requires GitHub access' });
            continue;
        }
        if (open) {
            const summary = page.locator(open).first();
            try {
                // GitHub may render the lazy asset list already expanded, below the viewport.
                await summary.scrollIntoViewIfNeeded({ timeout });
                if (await summary.getAttribute('aria-expanded', { timeout }) === 'false') await summary.click({ timeout });
            } catch {
                // A missing control will be represented by the empty rendered value.
            }
        }
        await Promise.all(controls.map(({ location }) =>
            page.locator(location).first().waitFor({ state: 'attached', timeout }).catch(() => {})));
        const baseline = await readControls(page, controls);
        await setLocalization(true);
        try {
            const rendered = await readControls(page, controls);
            results.push({
                ...result, controls: controls.map((item, index) => ({
                    ...item, source: baseline[index] || item.source, rendered: rendered[index],
                })),
            });
        } finally {
            await setLocalization(false);
        }
    }
    return results;
}

async function inspectLive(mode) {
    const temp = await mkdtemp(join(tmpdir(), 'yoread-github-inspection-'));
    const extension = join(temp, 'extension');
    let context;
    try {
        await cp(resolve('dist/extension'), extension, { recursive: true });
        const manifestPath = join(extension, 'manifest.json');
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        // Give only the temporary test installation site access, without native browser prompts.
        manifest.host_permissions = [`${github}/*`];
        await writeFile(manifestPath, JSON.stringify(manifest));
        context = await chromium.launchPersistentContext(join(temp, 'profile'), {
            channel: 'chromium',
            args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--disable-background-networking'],
        });
        await context.route(/^https?:\/\//, route => {
            const address = new URL(route.request().url());
            const readOnly = ['GET', 'HEAD'].includes(route.request().method());
            return readOnly && [github, 'https://github.githubassets.com'].includes(address.origin)
                ? route.continue() : route.abort();
        });
        const [worker = await context.waitForEvent('serviceworker', { timeout })] = context.serviceWorkers();
        const page = context.pages()[0];
        const popup = await context.newPage();
        await popup.goto(new URL('popup.html', worker.url()).href);
        const switchControl = popup.locator('#github');
        const status = popup.locator('#github-status');
        const setLocalization = async enabled => {
            await switchControl.setChecked(enabled, { timeout });
            await expect(status).toHaveText(enabled ? 'GitHub 汉化已开启。' : 'GitHub 汉化已关闭。', { timeout });
            const modeControl = popup.locator('#github-mode');
            if (enabled && await modeControl.inputValue() !== mode) {
                await modeControl.selectOption(mode, { timeout });
                await expect(status).toHaveText('已切换到专业档。', { timeout });
            }
        };
        const browser = await page.evaluate(() => navigator.userAgent);
        const samples = await collectGithubSamples(page, setLocalization);
        return { browser, samples };
    } finally {
        await context?.close();
        await rm(temp, { recursive: true, force: true });
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { values: { mode } } = parseArgs({ options: { mode: { type: 'string', default: 'beginner' } } });
        if (!['beginner', 'professional'].includes(mode)) throw new Error('--mode must be beginner or professional');
        const { browser, samples } = await inspectLive(mode);
        const report = spawnSync(process.execPath, ['scripts/github-inspection.mjs', '--mode', mode], {
            input: JSON.stringify(samples), encoding: 'utf8',
        });
        if (report.status !== 0 && report.status !== 1) throw new Error('Could not generate the inspection report');
        console.log(JSON.stringify({
            collectedAt: new Date().toISOString(), browser, ...JSON.parse(report.stdout), samples,
        }, null, 2));
        process.exitCode = report.status;
    } catch (error) {
        console.error(`Live GitHub inspection failed: ${error.message}`);
        process.exitCode = 2;
    }
}
