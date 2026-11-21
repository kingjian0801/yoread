/* SPDX-License-Identifier: GPL-3.0-or-later */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { runInNewContext } from 'node:vm';

const dictionaryPath = new URL('../extension/vendor/github/locals.js', import.meta.url);
const termsPath = new URL('../extension/github-terms.js', import.meta.url);
const normalize = text => text.trim().replace(/\s+/g, ' ');
const controlKinds = new Set(['ui', 'content', 'brand', 'identifier']);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());

function validateSample(sample, index, dictionary) {
    const label = `Sample ${index + 1}`;
    const { pageType, url, controls, error } = sample ?? {};
    if (typeof pageType !== 'string' || !Object.hasOwn(dictionary, pageType) || pageType === 'public') {
        throw new Error(`${label} requires a known dictionary pageType`);
    }
    if (typeof url !== 'string' || !URL.canParse(url)) {
        throw new Error(`${label} requires a valid GitHub URL`);
    }
    const address = new URL(url);
    if (address.origin !== 'https://github.com' || address.username || address.password) {
        throw new Error(`${label} requires a credential-free https://github.com URL`);
    }
    if (error !== undefined) {
        if (!nonempty(error) || controls !== undefined) {
            throw new Error(`${label} requires an access error or a controls array`);
        }
    } else {
        if (!Array.isArray(controls)) throw new Error(`${label} requires a controls array`);
        for (const [offset, control] of controls.entries()) {
            const { kind = 'ui', location, source, rendered } = control ?? {};
            if (!controlKinds.has(kind) || (kind === 'ui' &&
                (!nonempty(location) || !nonempty(source) || typeof rendered !== 'string'))) {
                throw new Error(`${label} control ${offset + 1} requires a valid kind and UI location, source and rendered text`);
            }
        }
    }
    return address;
}

function lookup(dictionary, pageType, source) {
    const scopes = [dictionary[pageType], dictionary.public];
    for (const scope of scopes) {
        const entries = scope?.static || {};
        const value = Object.hasOwn(entries, source) ? entries[source] : undefined;
        if (typeof value === 'string') return value;
    }
    for (const scope of scopes) {
        for (const [pattern, replacement] of scope?.regexp || []) {
            try {
                const rendered = source.replace(pattern, replacement);
                if (rendered !== source) return rendered;
            } catch {
                // Some upstream rules require globals supplied only by the original userscript.
            }
        }
    }
}

function record(groups, category, source, pageKey, example) {
    const key = JSON.stringify([category, source]);
    if (!groups.has(key)) groups.set(key, { category, source, pages: new Map() });
    const pages = groups.get(key).pages;
    if (!pages.has(pageKey)) pages.set(pageKey, example);
}

function summarize(groups) {
    return [...groups.values()].map(({ category, source, pages }) => ({
        category, source, affectedPages: pages.size, examples: [...pages.values()],
    })).sort((a, b) => b.affectedPages - a.affectedPages || a.source.localeCompare(b.source, 'en'));
}

function inspect(samples, dictionary, terms, headerLabels, mode) {
    if (!Array.isArray(samples) || samples.length === 0) throw new Error('Expected a nonempty array of page samples');
    const pages = new Map();
    const findings = new Map();
    const retained = new Map();
    const accessFailures = new Map();
    for (const [index, sample] of samples.entries()) {
        const { origin, pathname } = validateSample(sample, index, dictionary);
        const { pageType, url, controls, error } = sample;
        const pageKey = JSON.stringify([pageType, origin, pathname.toLowerCase().replace(/\/+$/, '')]);
        if (error) {
            if (!accessFailures.has(pageKey)) accessFailures.set(pageKey, { pageType, url, error });
            continue;
        }
        if (!pages.has(pageKey)) pages.set(pageKey, { pageType, url, statuses: new Map() });
        const { statuses } = pages.get(pageKey);
        for (const control of controls) {
            if (control.kind && control.kind !== 'ui') continue;
            const original = control.source.trim();
            if (!/[A-Za-z]/.test(original) || original.length > 260) continue;
            const source = normalize(control.source);
            const rendered = normalize(control.rendered);
            const fixedLabel = control.attribute === 'aria-label' && Object.hasOwn(headerLabels, source)
                ? headerLabels[source] : undefined;
            const term = Object.hasOwn(terms, source) ? terms[source][mode] : undefined;
            const expected = fixedLabel ?? term ?? lookup(dictionary, pageType, source);
            const example = { pageType, url, location: control.location };
            let status = 'matched';
            if (expected === undefined) {
                status = 'unlisted';
                record(findings, 'unlisted', source, pageKey, example);
            } else if (normalize(expected) !== rendered) {
                status = 'ruleFailed';
                record(findings, 'rule-failed', source, pageKey, { ...example, expected, rendered });
            } else if (expected === source) {
                status = 'retained';
                record(retained, 'retained', source, pageKey, example);
            }
            if (!statuses.has(source) || status === 'ruleFailed') statuses.set(source, status);
        }
    }
    const pageSummaries = [...pages.values()].map(({ pageType, url, statuses }) => {
        const counts = { matched: 0, unlisted: 0, ruleFailed: 0, retained: 0 };
        for (const status of statuses.values()) counts[status]++;
        return { pageType, url, ...counts };
    });
    return {
        pages: pageSummaries,
        findings: summarize(findings),
        retained: summarize(retained),
        accessFailures: [...accessFailures.values()],
    };
}

try {
    const { values } = parseArgs({ options: {
        dictionary: { type: 'string' },
        mode: { type: 'string', default: 'beginner' },
    } });
    const { mode } = values;
    if (mode !== 'beginner' && mode !== 'professional') {
        throw new Error('--mode must be beginner or professional');
    }
    const samples = JSON.parse(readFileSync(0, 'utf8'));
    const dictionarySource = readFileSync(values.dictionary ?? dictionaryPath, 'utf8');
    const context = {};
    runInNewContext(dictionarySource, context, { timeout: 1000 });
    const hash = createHash('sha256').update(dictionarySource);
    if (existsSync(termsPath)) {
        const termsSource = readFileSync(termsPath, 'utf8');
        runInNewContext(termsSource, context, { timeout: 1000 });
        hash.update('\0').update(termsSource);
    }
    const result = inspect(samples, context.I18N['zh-CN'], context.yoreadGitHubTerms ?? {},
        context.yoreadGitHubHeaderLabels ?? {}, mode);
    const report = { dictionaryVersion: `sha256:${hash.digest('hex')}`, mode, ...result };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.findings.length || report.accessFailures.length ? 1 : 0;
} catch (error) {
    console.error(`GitHub inspection failed: ${error.message}`);
    process.exitCode = 2;
}
