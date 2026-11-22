import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

async function packageSafari(extensionDirectory, outputDirectory, team) {
    const extension = resolve(extensionDirectory);
    const output = resolve(outputDirectory);
    const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
    const optional = manifest.optional_host_permissions ?? [];
    if (manifest.manifest_version !== 3 || optional.length !== 1 || optional[0] !== 'https://github.com/*' ||
        manifest.host_permissions?.length || manifest.content_scripts?.length) {
        throw new Error('Safari candidate must use Manifest V3 with optional GitHub access only.');
    }
    if (process.platform !== 'darwin') throw new Error('Safari packaging requires macOS and Xcode.');

    const app = join(output, 'Yoread.app');
    await mkdir(output, { recursive: true });
    if (lstatSync(app, { throwIfNoEntry: false })) throw new Error(`Safari candidate already exists: ${app}`);

    const staging = await mkdtemp(join(output, '.yoread-safari-'));
    try {
        const build = join(staging, 'build');
        execFileSync('/usr/bin/xcrun', [
            'safari-web-extension-packager', extension, '--macos-only', '--swift', '--copy-resources',
            '--app-name', 'Yoread', '--bundle-identifier', 'io.github.kingjian0801.Yoread',
            '--project-location', staging, '--no-open', '--no-prompt',
        ], { stdio: 'inherit' });
        execFileSync('/usr/bin/xcrun', [
            'xcodebuild', '-project', join(staging, 'Yoread', 'Yoread.xcodeproj'),
            '-scheme', 'Yoread', '-configuration', 'Release', '-destination', 'generic/platform=macOS',
            '-derivedDataPath', build, '-quiet', 'build',
            'MACOSX_DEPLOYMENT_TARGET=15.0', 'ARCHS=arm64 x86_64', 'ONLY_ACTIVE_ARCH=NO',
            'CODE_SIGN_STYLE=Manual', `CODE_SIGN_IDENTITY=${team ? 'Apple Development' : '-'}`,
            `DEVELOPMENT_TEAM=${team ?? ''}`,
            `MARKETING_VERSION=${manifest.version}`,
        ], { stdio: 'inherit' });
        const candidate = join(build, 'Build', 'Products', 'Release', 'Yoread.app');
        execFileSync('/usr/bin/codesign', ['--verify', '--strict', '--deep', candidate], { stdio: 'inherit' });
        await rename(candidate, app);
        console.log(`Yoread Safari ${manifest.version}: ${app}`);
    } finally {
        await rm(staging, { recursive: true, force: true });
    }
}

try {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: { team: { type: 'string' } },
    });
    if (values.team !== undefined && !/^[A-Z0-9]{10}$/.test(values.team)) {
        throw new Error('--team requires a 10-character Apple Developer Team ID');
    }
    if (positionals.length !== 2) {
        throw new Error('Usage: node scripts/package-safari.mjs <safari-extension-dir> <output-dir> [--team TEAM_ID]');
    }
    await packageSafari(...positionals, values.team);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
