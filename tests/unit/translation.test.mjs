import assert from 'node:assert/strict';
import test from 'node:test';
import '../../extension/translation-rules.js';
import { parseTranslations, providerErrorCode } from '../../extension/provider.js';

const { splitText, batches, containsUntranslatedProse } = globalThis.yoreadTranslationRules;

test('splits at word boundaries without changing whitespace', () => {
    const left = 'a'.repeat(1200);
    const right = 'b'.repeat(900);
    assert.deepEqual(splitText(left + ' ' + right), [
        { source: left, result: null },
        { source: ' ' + right, result: null },
    ]);
    assert.deepEqual(splitText('  '), [{ source: '  ', result: '  ' }]);
});

test('does not split a surrogate pair when a long word has no spaces', () => {
    const left = 'x'.repeat(1799);
    const right = '🌐rest';
    assert.deepEqual(splitText(left + right).map(part => part.source), [left, right]);
});

test('batches a maximum of five fragments and skips completed fragments', () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ parts: splitText(String(i)) }));
    entries[1].parts[0].result = '已完成';
    assert.deepEqual([...batches(entries)].map(batch => batch.map(({ part }) => part.source)),
        [['0', '2', '3', '4', '5'], ['6']]);
});

test('starts a new batch when another fragment would exceed 4000 characters', () => {
    const inputs = [1800, 1800, 400, 1].map(size => ({ parts: splitText('a'.repeat(size)) }));
    assert.deepEqual([...batches(inputs)].map(batch => batch.map(({ part }) => part.source.length)),
        [[1800, 1800, 400], [1]]);
});

test('detects copied English even after a Chinese prefix', () => {
    const source = 'This extension can only read your page when you open it.';
    assert.equal(containsUntranslatedProse(source, source), true);
    assert.equal(containsUntranslatedProse(source, '译文。' + source.toUpperCase()), true);
    assert.equal(containsUntranslatedProse(source, '只有打开页面后，此扩展才能读取它。'), false);
});

test('allows product names and code terms to stay in English', () => {
    assert.equal(containsUntranslatedProse('Visual Studio Code', 'Visual Studio Code'), false);
    assert.equal(containsUntranslatedProse('When you open a tab, call activeTab.',
        '打开标签页时，调用 activeTab。'), false);
});

test('maps provider HTTP errors without treating an unknown error as success', () => {
    assert.deepEqual([400, 401, 402, 403, 422, 429, 503].map(providerErrorCode), [
        'invalid-config', 'unauthorized', 'balance', 'unauthorized',
        'invalid-config', 'rate-limit', 'service',
    ]);
});

const completion = (translations, finish_reason = 'stop') => ({
    choices: [{ finish_reason, message: { content: JSON.stringify({ translations }) } }],
});

test('decodes translations in original order and rejects incomplete responses', () => {
    assert.deepEqual(parseTranslations(completion(['甲', '乙']), 2), ['甲', '乙']);
    for (const invalid of [
        null, {}, completion(['甲']), completion(['甲', ' ']),
        completion(['甲', 2]), completion(['甲', '乙'], 'length'),
        { choices: [{ message: { content: 'not JSON' } }] },
    ]) {
        assert.throws(() => parseTranslations(invalid, 2));
    }
});
