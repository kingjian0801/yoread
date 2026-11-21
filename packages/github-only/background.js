import { createGithubSettings } from './github-settings.js';

const api = globalThis.browser ?? globalThis.chrome;
const github = createGithubSettings(api);

api.runtime.onMessage.addListener((message, sender, respond) => {
    const { type } = message ?? {};
    const fromPopup = sender.url === api.runtime.getURL('popup.html');
    const handlers = {
        'settings.get': () => github.read(),
        'github.set': () => github.setEnabled(message.enabled === true),
        'github.mode.set': () => github.setMode(message.mode),
    };
    const action = type === 'github.mode.get'
        ? () => github.contentSettings(sender)
        : fromPopup && Object.hasOwn(handlers, type) && handlers[type];
    if (!action) return false;
    Promise.resolve().then(action).then(respond, () => respond({ ok: false, code: 'service' }));
    return true;
});
