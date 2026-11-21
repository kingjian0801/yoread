import { testConnection, translateBatch } from './provider.js';

const githubScriptId = 'yoread-github';
const githubOrigin = 'https://github.com/*';
const githubFiles = ['vendor/github/locals.js', 'github-terms.js', 'github.js'];
const local = chrome.storage.local;
const restricted = () => ({ ok: false, code: 'unsupported' });
const success = (fields = {}) => ({ ok: true, ...fields });
const trustedStorage = local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
let githubUpdate = Promise.resolve();

const githubModeOf = mode => mode === 'professional' ? 'professional' : 'beginner';

function hasCurrentGithubFiles(script) {
    return script?.js?.length === githubFiles.length && githubFiles.every((file, index) => script.js[index] === file);
}

async function updateGithubTabs(settings, inject = false) {
    const tabs = await chrome.tabs.query({ url: githubOrigin });
    await Promise.allSettled(tabs.map(async ({ id }) => {
        if (inject) await chrome.scripting.executeScript({ target: { tabId: id }, files: githubFiles });
        await chrome.tabs.sendMessage(id, { type: 'content.github', ...settings }, { frameId: 0 });
    }));
}

async function setGithub(enabled) {
    if (enabled && !await chrome.permissions.contains({ origins: [githubOrigin] })) {
        return { ok: false, code: 'permission-denied' };
    }
    const [registered] = await chrome.scripting.getRegisteredContentScripts({ ids: [githubScriptId] });
    if (enabled && !registered) {
        await chrome.scripting.registerContentScripts([{
            id: githubScriptId, matches: [githubOrigin], js: githubFiles,
            runAt: 'document_idle', persistAcrossSessions: true,
        }]);
    } else if (enabled && !hasCurrentGithubFiles(registered)) {
        await chrome.scripting.updateContentScripts([{ id: githubScriptId, js: githubFiles }]);
    } else if (!enabled && registered) {
        await chrome.scripting.unregisterContentScripts({ ids: [githubScriptId] });
    }
    await local.set({ github: enabled });
    const { githubMode } = await local.get('githubMode');
    await updateGithubTabs({ enabled, mode: githubModeOf(githubMode) }, enabled);
    if (!enabled) {
        // Enterprise or test installations can grant the host as a required permission.
        // The local renderer is already disabled even if Chrome will retain that grant.
        await chrome.permissions.remove({ origins: [githubOrigin] }).catch(() => {});
    }
    return success({ github: enabled });
}

function queueGithub(change) {
    const update = githubUpdate.then(change);
    githubUpdate = update.catch(() => {});
    return update;
}

function changeGithub(enabled) {
    return queueGithub(() => setGithub(enabled));
}

function changeGithubMode(mode) {
    if (mode !== 'professional' && mode !== 'beginner') return restricted();
    return queueGithub(async () => {
        await local.set({ githubMode: mode });
        const { github } = await local.get('github');
        if (github) await updateGithubTabs({ enabled: true, mode });
        return success({ githubMode: mode });
    });
}

function restoreGithub() {
    return queueGithub(async () => {
        const { github } = await local.get('github');
        if (!github) return false;
        if (!await chrome.permissions.contains({ origins: [githubOrigin] })) {
            await setGithub(false);
            return false;
        }
        const [registered] = await chrome.scripting.getRegisteredContentScripts({ ids: [githubScriptId] });
        return hasCurrentGithubFiles(registered) || (await setGithub(true)).ok;
    });
}

function restoreGithubAfterStartup() {
    void restoreGithub().catch(() => {});
}

chrome.runtime.onInstalled.addListener(restoreGithubAfterStartup);
chrome.runtime.onStartup.addListener(restoreGithubAfterStartup);

chrome.permissions.onRemoved.addListener(({ origins }) => {
    if (origins?.includes(githubOrigin)) {
        void chrome.permissions.contains({ origins: [githubOrigin] })
            .then(granted => granted || changeGithub(false)).catch(() => {});
    }
});

async function pageAction(message) {
    const { tabId, type, documentId, token } = message;
    if (!Number.isInteger(tabId)) return restricted();
    try {
        const [frame] = await chrome.scripting.executeScript({
            target: { tabId }, files: ['translation-rules.js', 'page.js'],
        });
        if (!frame?.documentId) return restricted();
        if (type === 'page.confirm' && frame.documentId !== documentId) {
            return { ok: false, code: 'page-changed' };
        }
        if (type === 'page.restore' && documentId && frame.documentId !== documentId) {
            return { ok: false, code: 'page-changed' };
        }
        if (type === 'page.dismiss' && frame.documentId !== documentId) return success({ state: 'idle' });
        const reply = await chrome.tabs.sendMessage(tabId, {
            type: type.replace('page.', 'content.'), token,
        }, { documentId: frame.documentId });
        return { ...reply, documentId: frame.documentId };
    } catch {
        return restricted();
    }
}

async function handle(message, sender) {
    await trustedStorage;
    if (message.type === 'github.mode.get') {
        if (sender.frameId !== 0 || !sender.tab?.id ||
            !sender.url?.startsWith('https://github.com/')) return restricted();
        const { github, githubMode } = await local.get(['github', 'githubMode']);
        return success({ enabled: github === true, mode: githubModeOf(githubMode) });
    }
    if (message.type === 'provider.translate') {
        if (sender.frameId !== 0 || !sender.tab?.id || !sender.documentId ||
            !/^https?:\/\//.test(sender.url || '')) return restricted();
        const frame = await chrome.webNavigation.getFrame({ tabId: sender.tab.id, frameId: 0 });
        if (frame?.documentId !== sender.documentId || frame.url !== message.url) {
            return { ok: false, code: 'page-changed' };
        }
        if (!Array.isArray(message.texts) || message.texts.length < 1 || message.texts.length > 5 ||
            message.texts.some(text => typeof text !== 'string' || !text.trim()) ||
            message.texts.reduce((size, text) => size + text.length, 0) > 4000) {
            return { ok: false, code: 'response' };
        }
        const { key } = await local.get('key');
        return success({ translations: await translateBatch(key, message.texts) });
    }

    if (sender.url !== chrome.runtime.getURL('popup.html')) return restricted();
    switch (message.type) {
        case 'settings.get': {
            const [{ key, githubMode }, github] = await Promise.all([
                local.get(['key', 'githubMode']), restoreGithub(),
            ]);
            return success({ configured: Boolean(key), github, githubMode: githubModeOf(githubMode) });
        }
        case 'settings.save': {
            const key = typeof message.key === 'string' ? message.key.trim() : '';
            if (!key || key.length > 512 || /\s/.test(key)) return { ok: false, code: 'invalid-config' };
            await local.set({ key });
            return success();
        }
        case 'settings.clear':
            await local.remove('key');
            return success();
        case 'settings.test': {
            const { key } = await local.get('key');
            await testConnection(key);
            return success();
        }
        case 'github.set':
            return changeGithub(message.enabled === true);
        case 'github.mode.set':
            return changeGithubMode(message.mode);
        case 'page.translate': {
            const { key } = await local.get('key');
            if (!key) return { ok: false, code: 'missing-key' };
            return pageAction(message);
        }
        case 'page.status':
        case 'page.confirm':
        case 'page.dismiss':
        case 'page.restore':
            return pageAction(message);
        default:
            return restricted();
    }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!message || typeof message.type !== 'string') return false;
    handle(message, sender).then(respond, error => respond({ ok: false, code: error.code || 'service' }));
    return true;
});
