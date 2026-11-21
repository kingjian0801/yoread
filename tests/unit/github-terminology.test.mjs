import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../scripts/github-terminology.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

function fixture(t, source) {
    const dir = mkdtempSync(join(tmpdir(), 'yoread-terminology-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, 'terms.json');
    writeFileSync(file, typeof source === 'string' ? source : JSON.stringify(source));
    return file;
}

const sample = (translations, scope = 'common') => ({
    english: '<strong>{count} commits</strong>',
    scope,
    example: '提交列表显示提交数。',
    translations: {
        'zh-CN': {
            beginner: '<strong>{count} 次提交</strong>',
            professional: '<strong>{count} 次提交</strong>',
            ...translations,
        },
    },
});

test('finds two modes and the context for an English term', () => {
    const result = run('query', '--english', 'pull requests', '--scope', 'repository/pulls');
    assert.equal(result.status, 0, result.stderr);
    const entries = JSON.parse(result.stdout);
    const list = entries.find(entry => entry.english === 'Pull requests' && entry.scope === 'repository/pulls');
    assert.deepEqual(list.translations['zh-CN'], {
        beginner: '拉取请求（PR）',
        professional: 'PR 列表',
    });
    assert.ok(list.example);
    assert.ok(entries.some(entry => entry.scope === 'common'));
    assert.ok(entries.every(entry => ['common', 'repository/pulls'].includes(entry.scope)));
    const fork = JSON.parse(run('query', '--english', 'fork', '--scope', 'repository').stdout)[0];
    assert.equal(fork.translations['zh-CN'].professional, 'Fork');
    assert.ok(fork.keepEnglish);
});

test('validates the project catalogue used by the extension builds', () => {
    const result = run('validate');
    assert.equal(result.status, 0, result.stderr);
});

test('validates a page exception with a preserved tag and placeholder', t => {
    const reordered = {
        ...sample({
            beginner: '<strong>$<repository> 的 $<count> 次提交</strong>',
            professional: '<strong>$<repository> 的 $<count> 次提交</strong>',
        }),
        english: '<strong>$<count> commits in $<repository></strong>',
    };
    const file = fixture(t, {
        locales: ['zh-CN'],
        entries: [sample(), sample({ professional: '<strong>{count} 个提交</strong>' }, 'repository/pulls'), reordered],
    });
    const result = run('validate', '--file', file);
    assert.equal(result.status, 0, result.stderr);
});

test('reports invalid terminology with the file and affected field', async t => {
    const cases = [
        ['duplicate JSON key', JSON.stringify({ locales: ['zh-CN'], entries: [sample()] })
            .replace('"beginner":', '"beginner":"重复", "beginner":'), /duplicate JSON key "beginner"/],
        ['duplicate term', { entries: [sample(), sample()] }, /entries\[1\].*duplicate entry/],
        ['empty translation', { entries: [sample({ beginner: ' ' })] }, /entries\[0\].*beginner.*empty/],
        ['missing inline tag', { entries: [sample({ professional: '{count} 次提交' })] }, /entries\[0\].*professional.*inline tags/],
        ['changed inline attributes', { entries: [{
            ...sample({
                beginner: '<a href="$<url>" title="$<title>">打开</a>',
                professional: '<a href="$<title>" title="$<url>">打开</a>',
            }),
            english: '<a href="$<url>" title="$<title>">Open</a>',
        }] }, /entries\[0\].*professional.*inline tags/],
        ['missing placeholder', { entries: [sample({ professional: '<strong>提交</strong>' })] }, /entries\[0\].*professional.*placeholders/],
        ['page rule conflict', { entries: [
            sample({}, 'repository/issues'),
            sample({ professional: '<strong>{count} 个提交</strong>' }, 'repository/issues'),
        ] }, /entries\[1\].*conflicting page rule.*repository\/issues/],
        ['unavailable page rule', { entries: [sample({}, 'repository/actions')] },
            /entries\[0\].scope.*unknown rule scope repository\/actions/],
        ['missing supported locale', { locales: ['zh-CN', 'fr'], entries: [sample()] }, /entries\[0\].*fr.*missing translation/],
        ['missing English retention reason', { entries: [sample({ professional: sample().english })] }, /entries\[0\].*keepEnglish/],
        ['missing safety review', { entries: [{
            ...sample({ beginner: '确认合并', professional: '确认合并' }, 'repository/pull'),
            english: 'Confirm merge',
        }] }, /entries\[0\].*review/],
    ];
    for (const [label, input, diagnostic] of cases) {
        await t.test(label, subtest => {
            const file = fixture(subtest, typeof input === 'string' ? input : { locales: ['zh-CN'], ...input });
            const result = run('validate', '--file', file);
            assert.equal(result.status, 1);
            assert.ok(result.stderr.includes(file), result.stderr);
            assert.match(result.stderr, diagnostic);
        });
    }
});
