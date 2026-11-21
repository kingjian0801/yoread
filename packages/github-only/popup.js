const api = globalThis.browser ?? globalThis.chrome;
const toggle = document.querySelector('#github');
const mode = document.querySelector('#github-mode');
const status = document.querySelector('#github-status');
let state;

function render() {
    toggle.checked = state.github;
    mode.value = state.githubMode;
    toggle.disabled = false;
    mode.disabled = false;
}

async function save(action, success) {
    toggle.disabled = mode.disabled = true;
    try {
        const reply = await action();
        if (reply?.ok) {
            state = { ...state, ...reply };
            status.textContent = success;
        } else {
            status.textContent = reply?.code === 'permission-denied'
                ? '请允许访问 github.com 后再试。'
                : '无法更新 GitHub 汉化设置。请重试。';
        }
    } catch {
        status.textContent = '无法更新 GitHub 汉化设置。请重试。';
    } finally {
        render();
    }
}

toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    void save(async () => {
        if (enabled && !await api.permissions.request({ origins: ['https://github.com/*'] })) {
            return { ok: false, code: 'permission-denied' };
        }
        return api.runtime.sendMessage({ type: 'github.set', enabled });
    }, enabled ? 'GitHub 汉化已开启。' : 'GitHub 汉化已关闭。');
});

mode.addEventListener('change', () => {
    void save(() => api.runtime.sendMessage({ type: 'github.mode.set', mode: mode.value }), '汉化模式已更新。');
});

api.runtime.sendMessage({ type: 'settings.get' }).then(reply => {
    if (!reply?.ok) throw new Error('Settings unavailable');
    state = reply;
    render();
}).catch(() => { status.textContent = '无法读取 GitHub 汉化设置。请重新打开。'; });
