(() => {
    if (globalThis.yoreadPage) return;

    const ignored = [
        'script', 'style', 'noscript', 'template', 'pre', 'code', 'kbd', 'samp', 'var',
        'input', 'textarea', 'select', 'output', 'button', 'label:has(input)', '[role="textbox"]',
        '[contenteditable]:not([contenteditable="false"])', 'svg', 'math', '[hidden]',
        '[inert]', '[aria-hidden="true"]', '[translate="no"]', '.notranslate',
    ].join(',');
    const githubCode = '.blob-code,.diff-text-inner,.js-full-logs-container,.cm-scroller,.react-code-text';
    const translated = new Map();
    let url = location.href;
    let consent = false;
    let pending = null;
    let job = null;
    let retry = null;
    let status = { state: 'idle' };

    function release(owns) {
        for (const [node, { original, rendered }] of translated) {
            if (!owns(node)) continue;
            if (node.isConnected && node.data === rendered) node.data = original;
            translated.delete(node);
        }
        if (status.translated !== undefined) status = { ...status, translated: translated.size };
    }
    globalThis.yoreadPage = { release };

    function revert() {
        release(() => true);
        pending = null;
        job = null;
        retry = null;
    }

    function syncPage() {
        if (url === location.href) return;
        revert();
        url = location.href;
        consent = false;
        status = { state: 'idle' };
    }

    globalThis.navigation?.addEventListener('currententrychange', syncPage);
    addEventListener('popstate', syncPage);
    addEventListener('hashchange', syncPage);
    addEventListener('pagehide', () => {
        revert();
        consent = false;
        status = { state: 'idle' };
    });

    function visible(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(ignored) ||
            (location.hostname === 'github.com' && parent.closest(githubCode))) return false;
        const github = globalThis.yoreadGitHub;
        if (github && (github.excludes?.(node) ?? github.owns(node))) return false;
        if (getComputedStyle(parent).visibility !== 'visible') return false;
        // Text under display: contents has no parent box but inherits the containing box's opacity.
        let box = parent;
        while (box && getComputedStyle(box).display === 'contents') box = box.parentElement;
        if (box?.checkVisibility?.({ checkOpacity: true }) === false) return false;
        const range = document.createRange();
        range.selectNodeContents(node);
        return Array.from(range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0);
    }

    function candidates() {
        for (const [node, value] of translated) {
            if (!node.isConnected || node.data !== value.rendered) translated.delete(node);
        }
        if (!document.body) return [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const entries = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!translated.has(node) && /[A-Za-z]{2}/.test(node.data) && visible(node)) {
                entries.push({ node, original: node.data });
            }
        }
        return entries;
    }

    function splitText(text) {
        const parts = [];
        let offset = 0;
        while (offset < text.length) {
            let end = Math.min(offset + 1800, text.length);
            if (end < text.length) {
                const atSpace = text.lastIndexOf(' ', end);
                if (atSpace > offset + 900) end = atSpace;
                else if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
            }
            const source = text.slice(offset, end);
            parts.push({ source, result: source.trim() ? null : source });
            offset = end;
        }
        return parts;
    }

    function* batches(entries) {
        let batch = [];
        let length = 0;
        for (const entry of entries) {
            for (const part of entry.parts) {
                if (part.result !== null) continue;
                if (batch.length === 5 || length + part.source.length > 4000) {
                    yield batch;
                    batch = [];
                    length = 0;
                }
                batch.push({ entry, part });
                length += part.source.length;
            }
        }
        if (batch.length) yield batch;
    }

    const isCurrent = current => {
        syncPage();
        return job === current;
    };
    const applicable = ({ node, original }) => node.isConnected && node.data === original && visible(node);

    async function run(current) {
        let error;
        let applied = 0;
        const changed = new Set();
        for (const batch of batches(current.entries)) {
            if (!isCurrent(current)) return;
            const ready = batch.filter(({ entry }) => !changed.has(entry) && applicable(entry));
            for (const { entry } of batch) if (!applicable(entry)) changed.add(entry);
            if (!ready.length) continue;
            let reply;
            try {
                reply = await chrome.runtime.sendMessage({
                    type: 'provider.translate', url,
                    texts: ready.map(({ part }) => part.source.trim()),
                });
            } catch {
                reply = { ok: false, code: 'network' };
            }
            if (!isCurrent(current)) return;
            if (!reply?.ok) {
                error ||= reply?.code || 'service';
                if (['unauthorized', 'missing-key', 'balance', 'rate-limit', 'page-changed'].includes(error)) break;
                continue;
            }
            ready.forEach(({ part }, i) => {
                part.result = part.source.replace(part.source.trim(), () => reply.translations[i]);
            });
            for (const entry of new Set(ready.map(({ entry }) => entry))) {
                if (changed.has(entry) || !applicable(entry) || !entry.parts.every(part => part.result !== null)) continue;
                const rendered = entry.parts.map(part => part.result).join('');
                translated.set(entry.node, { original: entry.original, rendered });
                entry.node.data = rendered;
                applied++;
            }
        }
        if (!isCurrent(current)) return;
        const failures = current.entries.filter(entry => !changed.has(entry) &&
            applicable(entry) && entry.parts.some(part => part.result === null));
        job = null;
        retry = failures.length ? failures : null;
        const count = current.prior + applied;
        status = {
            state: failures.length ? (count ? 'partial' : 'error') : (applied ? 'done' : 'empty'),
            translated: translated.size, failed: failures.length, error,
        };
    }

    function start(entries) {
        if (job) return status;
        if (!entries.length) return (status = { state: 'empty', translated: translated.size });
        const prior = translated.size;
        job = { entries: entries.map(entry => ({ ...entry, parts: entry.parts || splitText(entry.original) })), prior };
        retry = null;
        status = { state: 'working', translated: prior };
        const current = job;
        void run(current).catch(() => {
            if (!isCurrent(current)) return;
            job = null;
            retry = current.entries.filter(applicable);
            status = {
                state: translated.size ? 'partial' : 'error', translated: translated.size,
                failed: retry.length, error: 'service',
            };
        });
        return status;
    }

    function handle({ type, token }) {
        syncPage();
        switch (type) {
            case 'content.status':
                return status;
            case 'content.translate': {
                if (job) return status;
                if (retry) {
                    const failures = retry.filter(applicable);
                    retry = null;
                    if (failures.length) return start(failures);
                }
                const entries = candidates();
                if (!entries.length || consent) return start(entries);
                pending = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
                return { ...status, state: 'needs-consent', token: pending };
            }
            case 'content.confirm':
                if (!pending || pending !== token) return { ok: false, code: 'page-changed' };
                pending = null;
                consent = true;
                return start(candidates());
            case 'content.dismiss':
                if (token === pending) pending = null;
                return status;
            case 'content.restore':
                revert();
                return (status = { state: 'restored' });
            default:
                return { ok: false, code: 'unsupported' };
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id || ![
            'content.status', 'content.translate', 'content.confirm', 'content.dismiss', 'content.restore',
        ].includes(message?.type)) return;
        respond({ ok: true, ...handle(message) });
    });
})();
