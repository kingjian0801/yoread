import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.mjs',
    workers: 1,
    timeout: 45_000,
    expect: { timeout: 7_000 },
    reporter: 'list',
});
