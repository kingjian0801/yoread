import { testConnection, translateBatch } from './provider.js';
import { createGithubSettings } from './github-settings.js';

const local = chrome.storage.local;
const restricted = () => ({ ok: false, code: 'unsupported' });
const success = (fields = {}) => ({ ok: true, ...fields });
const trustedStorage = local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
const github = createGithubSettings(chrome);

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
    if (message.type === 'github.mode.get') return github.contentSettings(sender);
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
            const [{ key }, settings] = await Promise.all([local.get('key'), github.read()]);
            return { ...settings, configured: Boolean(key) };
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
            return github.setEnabled(message.enabled === true);
        case 'github.mode.set':
            return github.setMode(message.mode);
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
