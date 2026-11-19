import assert from 'node:assert/strict';
import test from 'node:test';

test('temporary PR probe verifies a failing integration suite blocks merging', () => {
    assert.fail('Intentional failure for the PR gate verification. Remove after checking the required job.');
});
