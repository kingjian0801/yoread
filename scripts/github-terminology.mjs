import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const cataloguePath = new URL('../data/github-terminology.json', import.meta.url);
const modes = ['beginner', 'professional'];
const scopes = new Set([
    'common', 'header-label', 'repository', 'repository/issues', 'repository/pulls',
    'repository/pull', 'repository/actions', 'repository/releases', 'repository/milestones',
    'repository/settings', 'issues',
]);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const tags = value =>
    value.match(/(?<!\$)<\/?[a-z][\w-]*(?:\s+(?:[^<>"']|"[^"]*"|'[^']*')*)?\/?>/gi) ?? [];
const placeholders = value =>
    (value.match(/\{\{[\w.]+\}\}|\{[\w.]+\}|\$(?:[1-9]\d*|<[\w.]+>)|%(?:\d+\$)?[sdif]/g) ?? []).sort();

function parseCatalogue(source) {
    // Native parsing checks the syntax. Scan the original tokens because it keeps only the last instance of a key.
    const catalogue = JSON.parse(source);
    const containers = [];
    const tokens = /("(?:[^"\\]|\\.)*")\s*(:)?|[{}\[\]]/gs;
    for (const match of source.matchAll(tokens)) {
        if (match[0] === '{') containers.push(new Set());
        else if (match[0] === '[') containers.push(null);
        else if (match[0] === '}' || match[0] === ']') containers.pop();
        else if (match[2]) {
            const key = JSON.parse(match[1]);
            const keys = containers.at(-1);
            if (keys.has(key)) {
                const line = source.slice(0, match.index).split('\n').length;
                throw new Error('line ' + line + ': duplicate JSON key ' + JSON.stringify(key));
            }
            keys.add(key);
        }
    }
    return catalogue;
}

function validateTranslation(entry, locale, location) {
    const pair = entry.translations[locale];
    if (!object(pair)) throw new Error(location + ': missing translation');
    for (const mode of modes) {
        const place = location + '.' + mode;
        const value = pair[mode];
        if (!nonempty(value)) throw new Error(place + ': empty or missing translation');
        if (value.trim() === entry.english && !nonempty(entry.keepEnglish)) {
            throw new Error(place + ': keepEnglish reason is required');
        }
        if (JSON.stringify(tags(entry.english)) !== JSON.stringify(tags(value))) {
            throw new Error(place + ': inline tags must match the English source');
        }
        if (JSON.stringify(placeholders(entry.english)) !== JSON.stringify(placeholders(value))) {
            throw new Error(place + ': placeholders must match the English source');
        }
    }
    if (entry.scope === 'header-label' && pair.beginner !== pair.professional) {
        throw new Error(location + ': a shared header label must be the same in both modes');
    }
}

function validateCatalogue(catalogue) {
    const { locales, entries } = catalogue ?? {};
    if (!Array.isArray(locales) || !locales.includes('zh-CN') ||
        locales.some(locale => typeof locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) ||
        new Set(locales).size !== locales.length) {
        throw new Error('locales: specify unique locale codes including zh-CN');
    }
    if (!Array.isArray(entries) || !entries.length) throw new Error('entries: expected a nonempty array');
    const seen = new Map();
    for (const [index, entry] of entries.entries()) {
        const location = 'entries[' + index + ']';
        if (!object(entry)) throw new Error(location + ': expected an entry object');
        const { english, scope, example, translations, review } = entry;
        if (!nonempty(english) || english !== english.trim().replace(/\s+/g, ' ')) {
            throw new Error(location + '.english: specify a label with normalized whitespace');
        }
        if (!scopes.has(scope)) throw new Error(location + '.scope: unknown rule scope ' + String(scope));
        const label = location + ' (' + JSON.stringify(english) + ', ' + scope + ')';
        const key = JSON.stringify([scope, english]);
        if (seen.has(key)) {
            const error = scope === 'common' || scope === 'header-label' ? 'duplicate entry' : 'conflicting page rule';
            throw new Error(location + ': ' + error + ' in ' + scope + ' for ' + JSON.stringify(english) +
                ', already at entries[' + seen.get(key) + ']');
        }
        seen.set(key, index);
        if (!nonempty(example)) throw new Error(label + '.example: add a usage example');
        if (/^(?:Merge |Confirm merge$|Delete )/.test(english) &&
            (!object(review) || !nonempty(review.note) || !String(review.reference).startsWith('https://docs.github.com/'))) {
            throw new Error(label + '.review: add a GitHub Docs reference and a review note');
        }
        if (!object(translations)) throw new Error(label + '.translations: expected translations by locale');
        for (const locale of Object.keys(translations)) {
            if (!locales.includes(locale)) throw new Error(label + '.translations.' + locale + ': undeclared locale');
        }
        for (const locale of locales) validateTranslation(entry, locale, label + '.translations.' + locale);
    }
}

export function readTerminology(file = cataloguePath) {
    try {
        const source = readFileSync(file, 'utf8');
        const catalogue = parseCatalogue(source);
        validateCatalogue(catalogue);
        return { source, catalogue };
    } catch (error) {
        throw new Error((file instanceof URL ? fileURLToPath(file) : file) + ': ' + error.message);
    }
}

export function terminologyMaps(catalogue) {
    const common = Object.create(null);
    const headerLabels = Object.create(null);
    const pages = Object.create(null);
    for (const { english, scope, translations } of catalogue.entries) {
        const wording = translations['zh-CN'];
        if (scope === 'common') common[english] = wording;
        else if (scope === 'header-label') headerLabels[english] = wording.beginner;
        else {
            pages[scope] ??= Object.create(null);
            pages[scope][english] = wording;
        }
    }
    return { common, headerLabels, pages };
}

export function terminologyScript() {
    const { catalogue } = readTerminology();
    const { common, headerLabels, pages } = terminologyMaps(catalogue);
    const globals = {
        yoreadGitHubTerms: common,
        yoreadGitHubHeaderLabels: headerLabels,
        yoreadGitHubPageTerms: pages,
    };
    const assignments = Object.entries(globals).map(([name, value]) =>
        'globalThis.' + name + ' = Object.freeze(JSON.parse(' + JSON.stringify(JSON.stringify(value)) + '));');
    return '/* SPDX-License-Identifier: GPL-3.0-or-later */\n' + assignments.join('\n') + '\n';
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    try {
        const { values, positionals } = parseArgs({
            allowPositionals: true,
            options: { english: { type: 'string' }, scope: { type: 'string' }, file: { type: 'string' } },
        });
        const [command] = positionals;
        if (positionals.length !== 1 || !['query', 'validate'].includes(command)) {
            throw new Error('Usage: node scripts/github-terminology.mjs <query|validate> [--english text] [--scope page] [--file path]');
        }
        const { catalogue } = readTerminology(values.file);
        if (command === 'validate') {
            console.log('Validated ' + catalogue.entries.length + ' terminology entries (' + catalogue.locales.join(', ') + ').');
        } else {
            const english = values.english?.trim().toLowerCase();
            const entries = catalogue.entries.filter(entry =>
                (!english || entry.english.toLowerCase().includes(english)) &&
                (!values.scope || entry.scope === values.scope || entry.scope === 'common'));
            console.log(JSON.stringify(entries, null, 2));
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
