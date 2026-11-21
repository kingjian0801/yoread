const githubScriptId = 'yoread-github';
const githubOrigin = 'https://github.com/*';
const githubFiles = ['vendor/github/locals.js', 'github-terms.js', 'github.js'];

export function createGithubSettings(api) {
    const local = api.storage.local;
    const success = (fields = {}) => ({ ok: true, ...fields });
    let githubUpdate = Promise.resolve();

    const githubModeOf = mode => mode === 'professional' ? 'professional' : 'beginner';

    function hasCurrentGithubFiles(script) {
        return script?.js?.length === githubFiles.length && githubFiles.every((file, index) => script.js[index] === file);
    }

    async function updateGithubTabs(settings, inject = false) {
        const tabs = await api.tabs.query({ url: githubOrigin });
        await Promise.allSettled(tabs.map(async ({ id }) => {
            if (inject) await api.scripting.executeScript({ target: { tabId: id }, files: githubFiles });
            await api.tabs.sendMessage(id, { type: 'content.github', ...settings }, { frameId: 0 });
        }));
    }

    async function setGithub(enabled) {
        if (enabled && !await api.permissions.contains({ origins: [githubOrigin] })) {
            return { ok: false, code: 'permission-denied' };
        }
        const [registered] = await api.scripting.getRegisteredContentScripts({ ids: [githubScriptId] });
        if (enabled && !registered) {
            await api.scripting.registerContentScripts([{
                id: githubScriptId, matches: [githubOrigin], js: githubFiles,
                runAt: 'document_idle', persistAcrossSessions: true,
            }]);
        } else if (enabled && !hasCurrentGithubFiles(registered)) {
            await api.scripting.updateContentScripts([{ id: githubScriptId, js: githubFiles }]);
        } else if (!enabled && registered) {
            await api.scripting.unregisterContentScripts({ ids: [githubScriptId] });
        }
        await local.set({ github: enabled });
        const { githubMode } = await local.get('githubMode');
        await updateGithubTabs({ enabled, mode: githubModeOf(githubMode) }, enabled);
        if (!enabled) {
            // Enterprise or test installations can grant the host as a required permission.
            // The local renderer is already disabled even if Chrome will retain that grant.
            await api.permissions.remove({ origins: [githubOrigin] }).catch(() => {});
        }
        return success({ github: enabled });
    }

    function queueGithub(change) {
        const update = githubUpdate.then(change);
        githubUpdate = update.catch(() => {});
        return update;
    }

    function setEnabled(enabled) {
        return queueGithub(() => setGithub(enabled));
    }

    function setMode(mode) {
        if (mode !== 'professional' && mode !== 'beginner') return { ok: false, code: 'unsupported' };
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
            if (!await api.permissions.contains({ origins: [githubOrigin] })) {
                await setGithub(false);
                return false;
            }
            const [registered] = await api.scripting.getRegisteredContentScripts({ ids: [githubScriptId] });
            return hasCurrentGithubFiles(registered) || (await setGithub(true)).ok;
        });
    }

    function restoreGithubAfterStartup() {
        void restoreGithub().catch(() => {});
    }

    api.runtime.onInstalled.addListener(restoreGithubAfterStartup);
    api.runtime.onStartup.addListener(restoreGithubAfterStartup);

    api.permissions.onRemoved.addListener(({ origins }) => {
        if (origins?.includes(githubOrigin)) {
            void api.permissions.contains({ origins: [githubOrigin] })
                .then(granted => granted || setEnabled(false)).catch(() => {});
        }
    });

    async function read() {
        const [github, { githubMode }] = await Promise.all([restoreGithub(), local.get('githubMode')]);
        return success({ github, githubMode: githubModeOf(githubMode) });
    }

    async function contentSettings(sender) {
        if (sender.frameId !== 0 || !sender.tab?.id ||
            !sender.url?.startsWith('https://github.com/')) return { ok: false, code: 'unsupported' };
        const { github, githubMode } = await local.get(['github', 'githubMode']);
        return success({ enabled: github === true, mode: githubModeOf(githubMode) });
    }

    return { read, contentSettings, setEnabled, setMode };
}
