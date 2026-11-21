import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { terminologyScript } from './github-terminology.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'extension');
const target = join(root, 'dist', 'extension');
const terminology = terminologyScript();
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
for (const file of [manifest.action.default_popup, manifest.background.service_worker,
    'provider.js', 'page.js', 'translation-rules.js', 'github.js', 'vendor/github/locals.js']) {
    await readFile(join(source, file));
}
await mkdir(join(root, 'dist'), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
await writeFile(join(target, 'github-terms.js'), terminology);
for (const name of ['LICENSE', 'LICENSE-MIT-ORIGINAL']) await cp(join(root, name), join(target, name));
console.log(`Yoread ${manifest.version}: ${target}`);
