import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../../scripts/github-inspection.mjs', import.meta.url));
const repo = 'https://github.com/acme/demo';

function inspect(samples, ...args) {
    return spawnSync(process.execPath, [cli, ...args], {
        input: JSON.stringify(samples),
        encoding: 'utf8',
    });
}

function candidateDictionary(t, extra) {
    const directory = mkdtempSync(join(tmpdir(), 'yoread-inspection-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const candidate = join(directory, 'locals.js');
    const upstream = readFileSync(new URL('../../extension/vendor/github/locals.js', import.meta.url), 'utf8');
    writeFileSync(candidate, upstream + '\n' + extra + '\n');
    return candidate;
}

test('reports a newly observed button and the dictionary version', () => {
    const result = inspect([{
        pageType: 'repository',
        url: repo,
        controls: [
            { source: 'Code', rendered: '代码', location: 'nav [data-tab-item="code"]' },
            { source: 'Inspect  snapshot', rendered: 'Inspect snapshot', location: '#inspect-snapshot' },
        ],
    }]);
    assert.notEqual(result.stdout.trim(), '', result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(result.status, 1, result.stderr);
    assert.match(report.dictionaryVersion, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(report.findings, [{
        category: 'unlisted',
        source: 'Inspect snapshot',
        affectedPages: 1,
        examples: [{ pageType: 'repository', url: repo, location: '#inspect-snapshot' }],
    }]);
    assert.equal(report.pages[0].matched, 1);
});

test('reports an existing page-specific rule whose translation did not render', () => {
    const url = `${repo}/issues`;
    const result = inspect([{
        pageType: 'repository/issues',
        url,
        controls: [{ source: 'New issue', rendered: 'New issue', location: '[href$="/issues/new"]' }],
    }]);
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).findings, [{
        category: 'rule-failed',
        source: 'New issue',
        affectedPages: 1,
        examples: [{
            pageType: 'repository/issues',
            url,
            location: '[href$="/issues/new"]',
            expected: '创建议题',
            rendered: 'New issue',
        }],
    }]);
});

test('records retained terms and inaccessible pages without leaking protected content', () => {
    const result = inspect([
        {
            pageType: 'repository',
            url: repo,
            controls: [
                { source: 'Actions', rendered: 'Actions', location: 'nav > a' },
                { source: 'Private text', rendered: 'Private text', location: 'article', kind: 'content' },
                { source: 'GitHub', rendered: 'GitHub', location: '#brand', kind: 'brand' },
                { source: 'Settings', rendered: 'Settings', location: '#branch', kind: 'identifier' },
            ],
        },
        { pageType: 'repository/issues', url: `${repo}/issues`, error: '403 Forbidden' },
    ]);
    assert.notEqual(result.stdout.trim(), '', result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(report.findings, []);
    assert.deepEqual(report.retained.map(item => item.source), ['Actions']);
    assert.equal(report.pages[0].retained, 1);
    assert.deepEqual(report.accessFailures, [{
        pageType: 'repository/issues',
        url: `${repo}/issues`,
        error: '403 Forbidden',
    }]);
    assert.doesNotMatch(result.stdout, /Private text|"GitHub"|Settings/);
});

test('counts each affected page once and places wider findings first', () => {
    const control = (source, location) => ({ source, rendered: source, location });
    const result = inspect([
        { pageType: 'repository', url: repo, controls: [
            control('Alpha snapshot', '#alpha'),
            control('Inspect snapshot', '#first'),
            control('Inspect snapshot', '#menu-item'),
        ] },
        { pageType: 'repository', url: `${repo}?sample=logged-in`, controls: [
            control('Inspect snapshot', '#extra'),
        ] },
        { pageType: 'repository/issues', url: `${repo}/issues`, controls: [
            control('Inspect snapshot', '#list-action'),
        ] },
    ]);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.findings.map(({ source, affectedPages }) => [source, affectedPages]), [
        ['Inspect snapshot', 2],
        ['Alpha snapshot', 1],
    ]);
    assert.deepEqual(report.findings[0].examples.map(example => example.location), ['#first', '#list-action']);
    assert.equal(report.pages.length, 2);
    assert.equal(report.pages[0].unlisted, 2);
});

test('recognizes a rendered dynamic label and keeps the count', () => {
    const result = inspect([{
        pageType: 'repository',
        url: repo,
        controls: [{ source: '3 Commits', rendered: '3 次提交', location: '#commit-count' }],
    }]);
    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.equal(JSON.parse(result.stdout).pages[0].matched, 1);
});

test('passes the same page samples after the wording and rendering fixes', t => {
    const before = JSON.parse(readFileSync(new URL('../fixtures/github-inspection.json', import.meta.url), 'utf8'));
    const failing = inspect(before);
    assert.equal(failing.status, 1, failing.stderr);
    const failingReport = JSON.parse(failing.stdout);
    assert.deepEqual(failingReport.findings.map(({ category, source }) => [category, source]), [
        ['unlisted', 'Inspect snapshot'], ['rule-failed', 'New issue'],
    ]);

    const candidate = candidateDictionary(t, 'I18N["zh-CN"].repository.static["Inspect snapshot"] = "检查快照";');

    const after = structuredClone(before);
    for (const { controls } of after) {
        for (const control of controls) {
            if (control.source === 'Inspect snapshot') control.rendered = '检查快照';
            if (control.source === 'New issue') control.rendered = '创建议题';
        }
    }
    const passing = inspect(after, '--dictionary', candidate);
    assert.equal(passing.status, 0, passing.stdout || passing.stderr);
    const passingReport = JSON.parse(passing.stdout);
    assert.notEqual(passingReport.dictionaryVersion, failingReport.dictionaryVersion);
    assert.deepEqual(passingReport.findings, []);
    assert.deepEqual(passingReport.pages.map(page => page.matched), [1, 1]);
});

test('ignores malformed runs with an explicit sample error', () => {
    const result = inspect([{ pageType: 'repository', url: repo, controls: [{ source: 'Code' }] }]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Sample 1 control 1.*location, source and rendered/);
    assert.notEqual(inspect([]).status, 0);
});

test('checks terminology against the requested display mode', t => {
    const candidate = candidateDictionary(t, 'globalThis.yoreadGitHubTerms = { Fork: { beginner: "复刻（Fork）", professional: "Fork" } };');
    const sample = rendered => [{ pageType: 'repository', url: repo, controls: [
        { source: 'Fork', rendered, location: 'button[data-testid="fork"]' },
    ] }];
    const professional = inspect(sample('Fork'), '--dictionary', candidate, '--mode', 'professional');
    assert.equal(professional.status, 0, professional.stderr);
    assert.equal(JSON.parse(professional.stdout).retained[0].source, 'Fork');
    const beginner = inspect(sample('复刻（Fork）'), '--dictionary', candidate);
    assert.equal(beginner.status, 0, beginner.stderr);
    assert.equal(JSON.parse(beginner.stdout).pages[0].matched, 1);
});
