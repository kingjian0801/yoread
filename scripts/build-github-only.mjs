import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { terminologyScript } from './github-terminology.mjs';

const [browser, output] = process.argv.slice(2);
if (!['edge', 'firefox', 'safari'].includes(browser)) {
    console.error('Usage: node scripts/build-github-only.mjs <edge|firefox|safari> [output-directory]');
    process.exit(2);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'extension');
const target = output ? resolve(output) : join(root, 'dist', browser);
const terminology = terminologyScript();
const { name, version, action, optional_host_permissions } =
    JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
const manifest = {
    manifest_version: 3,
    name,
    version,
    description: '用本地词库将 GitHub 界面显示为简体中文。',
    action,
    optional_host_permissions,
    permissions: ['scripting', 'storage'],
    background: browser === 'edge'
        ? { service_worker: 'background.js', type: 'module' }
        : { scripts: ['background.js'], type: 'module' },
};
if (browser === 'firefox') {
    manifest.browser_specific_settings = { gecko: {
        id: 'yoread@kingjian0801.github.io',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
    } };
}

await mkdir(dirname(target), { recursive: true });
if (!output) await rm(target, { recursive: true, force: true });
await mkdir(target);
try {
    await cp(join(root, 'packages', 'github-only'), target, { recursive: true });
    await cp(join(source, 'vendor'), join(target, 'vendor'), { recursive: true });
    for (const file of ['github.js', 'github-settings.js']) {
        await cp(join(source, file), join(target, file));
    }
    await writeFile(join(target, 'github-terms.js'), terminology);
    for (const license of ['LICENSE', 'LICENSE-MIT-ORIGINAL']) await cp(join(root, license), join(target, license));
    await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
}
console.log(`Yoread ${version} (${browser}): ${target}`);
