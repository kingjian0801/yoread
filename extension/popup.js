const $ = id => document.getElementById(id);
const pageStatus = $('page-status');
const keySettings = $('key-settings');
const keyInput = $('key');
const githubSwitch = $('github');
const translate = $('translate');
const restore = $('restore');
const consent = $('consent');

const messages = {
  'missing-key': '请先在 DeepSeek 设置中保存 API Key。',
  unauthorized: 'DeepSeek 未通过鉴权。请检查或更换 API Key。',
  balance: 'DeepSeek API 余额不足。请充值后重试。',
  'rate-limit': 'DeepSeek 请求过多。请稍候再试。',
  timeout: 'DeepSeek 响应超时。请重试。',
  service: 'DeepSeek 服务暂不可用。请稍候再试。',
  response: 'DeepSeek 返回的译文格式不完整。请重试。',
  network: '无法连接 DeepSeek。请检查网络后重试。',
  'invalid-config': 'DeepSeek 拒绝了请求。请检查设置后重试。',
  unsupported: '当前页面不允许扩展读取。请打开普通网页后再试。',
  'unsupported-page': '当前页面不允许扩展读取。请打开普通网页后再试。',
  'page-changed': '页面已变化。请再次点击「翻译此页」。',
  'invalid-consent': '页面已变化。请再次点击「翻译此页」。',
};

let tabId;
let settingsKnown = false;
let configured = false;
let githubEnabled = false;
let settingsBusy = false;
let pageBusy = false;
let pageRevision = 0;
let timer;
let view = { state: 'idle' };

function errorMessage(code) {
  return messages[code] ?? '操作未完成。请重试。';
}

async function send(type, fields = {}) {
  try {
    return await chrome.runtime.sendMessage({ type, ...fields }) ?? { ok: false };
  } catch {
    return { ok: false };
  }
}

function pageMessage(state, translated, failed, code) {
  switch (state) {
    case 'needs-consent': return '确认后才会发送本页正文。';
    case 'working': return '正在翻译，可随时恢复原文。';
    case 'done': return translated ? `已翻译 ${translated} 段，可随时恢复原文。` : '已翻译，可随时恢复原文。';
    case 'partial': return `部分完成，${failed || '有'}段待重试。 ${code ? errorMessage(code) : ''}`.trim();
    case 'restored': return '已恢复原文。';
    case 'empty': return '当前没有待翻译的新正文。';
    case 'error': return errorMessage(code);
    default:
      if (code) return errorMessage(code);
      return configured ? '翻译当前页面中已加载的可读正文。' : messages['missing-key'];
  }
}

function renderPage() {
  const { state, translated, failed, error, code } = view;
  const awaitingConsent = state === 'needs-consent';
  const working = state === 'working';
  const problem = state === 'error' || state === 'partial';
  const blockedPage = code === 'unsupported' || code === 'unsupported-page';
  pageStatus.textContent = pageMessage(state, translated, failed, error ?? code);
  pageStatus.dataset.state = state;
  pageStatus.dataset.tone = problem ? 'error' : state === 'done' || state === 'restored' ? 'success' : '';
  translate.textContent = problem && !blockedPage ? '重试翻译' : '翻译此页';
  translate.disabled = !configured || tabId == null || pageBusy || awaitingConsent || working || blockedPage;
  restore.disabled = pageBusy || !(working || state === 'done' || state === 'partial' || translated > 0);
  consent.hidden = !awaitingConsent;
  $('confirm').disabled = pageBusy;
  $('dismiss').disabled = pageBusy;
}

function feedback(id, text, tone = '') {
  const output = $(id);
  output.textContent = text;
  output.hidden = !text;
  output.dataset.tone = tone;
}

function renderSettings() {
  $('key-state').textContent = configured ? '已配置' : '未配置';
  $('save-key').disabled = settingsBusy || !settingsKnown;
  $('test-key').disabled = settingsBusy || !configured;
  $('clear-key').disabled = settingsBusy || !configured;
  githubSwitch.checked = githubEnabled;
  renderPage();
}

async function refreshSettings({ initial = false } = {}) {
  const data = await send('settings.get');
  if (data.ok) {
    settingsKnown = true;
    configured = data.configured;
    githubEnabled = data.github;
    githubSwitch.disabled = false;
    if (initial) keySettings.open = !configured;
  } else {
    feedback('settings-status', errorMessage(data.code), 'error');
  }
  renderSettings();
}

async function findTab() {
  const [{ id } = {}] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
    windowType: 'normal',
  });
  const thisTab = await chrome.tabs.getCurrent();
  if (!thisTab || thisTab.id !== id) return id;

  // The popup also works when opened as an ordinary extension page.
  const tabs = await chrome.tabs.query({ windowId: thisTab.windowId });
  return tabs.filter(tab => tab.id !== thisTab.id)
    .sort((left, right) => right.lastAccessed - left.lastAccessed)[0]?.id;
}

function applyPageReply(reply) {
  view = reply.ok === false
    ? { ...reply, state: reply.state ?? 'error' }
    : { ...reply, state: reply.state ?? 'idle' };
  renderPage();
  if (view.state === 'working') timer = setTimeout(pollPage, 300);
}

async function pollPage() {
  const version = pageRevision;
  const reply = await send('page.status', { tabId });
  if (version === pageRevision) applyPageReply(reply);
}

async function pageAction(type) {
  if (tabId == null || pageBusy) return;
  const fields = { tabId };
  if (type === 'page.confirm' || type === 'page.dismiss') {
    if (view.state !== 'needs-consent' || !view.token || !view.documentId) return;
    fields.documentId = view.documentId;
    fields.token = view.token;
  }
  if (type === 'page.restore' && view.documentId) fields.documentId = view.documentId;

  clearTimeout(timer);
  pageRevision += 1;
  pageBusy = true;
  renderPage();
  const reply = await send(type, fields);
  pageBusy = false;
  applyPageReply(reply);
  if (view.state === 'needs-consent') $('confirm').focus();
  else if (type === 'page.dismiss' && !translate.disabled) translate.focus();
}

async function settingsAction(type, fields = {}) {
  if (settingsBusy) return;
  settingsBusy = true;
  renderSettings();
  feedback('settings-status', type === 'settings.test' ? '正在测试连接…' : '');
  const reply = await send(type, fields);
  if (reply.ok) {
    if (type === 'settings.save') {
      keyInput.value = '';
      configured = true;
      feedback('settings-status', '已保存 API Key。', 'success');
    } else if (type === 'settings.clear') {
      keyInput.value = '';
      configured = false;
      feedback('settings-status', '已清除 API Key。', 'success');
    } else {
      feedback('settings-status', 'DeepSeek 连接成功。', 'success');
    }
  } else {
    feedback('settings-status', errorMessage(reply.code), 'error');
  }
  settingsBusy = false;
  renderSettings();
}

$('key-form').addEventListener('submit', event => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key) {
    feedback('settings-status', '请输入 DeepSeek API Key。', 'error');
    keyInput.focus();
    return;
  }
  void settingsAction('settings.save', { key });
});

$('test-key').addEventListener('click', () => void settingsAction('settings.test'));
$('clear-key').addEventListener('click', () => void settingsAction('settings.clear'));
translate.addEventListener('click', () => void pageAction('page.translate'));
restore.addEventListener('click', () => void pageAction('page.restore'));
$('confirm').addEventListener('click', () => void pageAction('page.confirm'));
$('dismiss').addEventListener('click', () => void pageAction('page.dismiss'));

githubSwitch.addEventListener('change', async () => {
  const enabled = githubSwitch.checked;
  githubSwitch.disabled = true;
  feedback('github-status', '');
  try {
    const granted = !enabled || await chrome.permissions.request({ origins: ['https://github.com/*'] });
    if (!granted) {
      feedback('github-status', '已取消 GitHub 访问授权。', 'error');
      return;
    }
    const reply = await send('github.set', { enabled });
    if (reply.ok) {
      githubEnabled = enabled;
      feedback('github-status', enabled ? 'GitHub 汉化已开启。' : 'GitHub 汉化已关闭。', 'success');
    } else {
      feedback('github-status', errorMessage(reply.code), 'error');
    }
  } catch {
    feedback('github-status', '无法更新 GitHub 汉化设置。请重试。', 'error');
  } finally {
    githubSwitch.checked = githubEnabled;
    githubSwitch.disabled = false;
  }
});

await refreshSettings({ initial: true });
try {
  tabId = await findTab();
  if (tabId == null) {
    view = { state: 'idle', code: 'unsupported-page' };
    renderPage();
  } else {
    await pollPage();
  }
} catch {
  view = { state: 'idle', code: 'unsupported-page' };
  renderPage();
}
