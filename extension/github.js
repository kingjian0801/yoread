/* SPDX-License-Identifier: GPL-3.0-or-later */
(() => {
    if (globalThis.yoreadGitHub || location.origin !== 'https://github.com') return;
    const upstream = globalThis.I18N;
    const dictionary = upstream?.['zh-CN'];
    if (!dictionary) return;

    const fixed = [
        '.AppHeader', '.UnderlineNav', '.tabnav-tabs', 'nav[aria-label="Repository"]',
        'nav[aria-label="Repository navigation"]', 'nav[data-testid="repository-navbar"]',
        'a[data-dd-action-name^="pull_requests.navigation."]',
        '#repository-container-header', 'button', 'summary', '[role="button"]',
        'a.btn', 'a.Button', 'a[href$="/issues/new"]', 'a[href$="/issues/new/choose"]',
        '[role="tab"]', '[role="menuitem"]', '[role="menuitemcheckbox"]',
        '.State', '.StateLabel', '[data-testid="issue-state-badge"]',
        '[data-testid="state-label"]', '[class*="StateLabel"]',
    ].join(',');
    const userContent = [
        'article', '.markdown-body', '.js-comment-body', '.comment-body',
        '.js-issue-title', '.markdown-title', '[data-testid="issue-title"]',
        '[data-testid="issue-body"]', '[data-testid="comment-body"]',
    ].join(',');
    const identifiers = [
        '.AppHeader-context', '.branch-name', '[class*="branchName"]',
        '.commit-ref', '[class*="CommitRef"]',
        '[data-testid*="branch"]', '[data-testid*="ref-name"]', '.commit-author',
        '.commit-title', '.sha', '[data-commit-sha]', 'relative-time',
        'a[data-hovercard-type="user"]', 'a[data-hovercard-type="repository"]',
        '.user-mention', '.author', '.repo-and-owner', '.react-directory-filename-column',
        'nav[data-component="Breadcrumbs"]', 'a[href*="/commit/"]',
        'strong[itemprop="name"]', '[data-testid="repository-name"]',
    ].join(',');
    const protectedContent = [
        userContent, identifiers,
        'input', 'textarea', 'select', 'option', '[contenteditable]',
        'script', 'style', 'template', 'code', 'pre', 'kbd', 'samp', 'svg',
        '[hidden]', '[inert]', '[aria-hidden="true"]', '[translate="no"]',
    ].join(',');
    const changed = new Map();
    const queued = new Set();
    const cache = new Map();
    let enabled = false;
    let route;
    let page;
    let repoPath;
    let ignore;
    let timer;

    function readRoute() {
        restore();
        cache.clear();
        route = location.pathname;
        const [owner, repo, section] = route.split('/').filter(Boolean);
        const kind = route.match(upstream.conf.rePagePathRepo)?.[1];
        const supported = !section || (section === kind && ['issues', 'pull', 'pulls'].includes(kind));
        const reserved = owner && ('/' + owner.toLowerCase() + '/').match(upstream.conf.rePagePath)?.[1] === owner.toLowerCase();
        const key = kind ? `repository/${kind}` : 'repository';
        page = owner && repo && !reserved && supported ? dictionary[key] : null;
        repoPath = page ? `/${owner}/${repo}`.toLowerCase() : '';
        // The upstream feature varies these exclusions by page and combines its global entries.
        const skip = upstream.conf.ignoreSelectorPage;
        ignore = [...(skip['*'] || []), ...(skip[key] || [])].join(',');
    }

    function restore() {
        for (const [node, { original, rendered }] of changed) {
            if (node.isConnected && node.data === rendered) node.data = original;
        }
        changed.clear();
    }

    function isIdentifier(element) {
        const link = element.closest('a[href]');
        if (!link) return false;
        const path = link.pathname.toLowerCase().replace(/\/+$/, '');
        if (link.origin !== location.origin || !path.startsWith(repoPath + '/')) {
            // The native "Code" repository tab links to its own repository root.
            return path !== repoPath || !/^(?:Code|代码)$/.test(link.textContent.trim()) ||
                path.split('/').at(-1) === 'code';
        }
        return /^\/(?:tree|commit|blob|releases\/tag|compare)\//.test(path.slice(repoPath.length));
    }

    function owns(node) {
        if (!enabled) return false;
        if (route !== location.pathname) readRoute();
        const element = node.parentElement;
        if (!page || !element?.closest(fixed) || element.closest(protectedContent) ||
            isIdentifier(element)) return false;
        return !ignore || !element.closest(ignore);
    }

    function excludes(node) {
        if (!enabled) return false;
        if (route !== location.pathname) readRoute();
        const element = node.parentElement;
        return Boolean(page && element && (element.closest(identifiers) ||
            (element.closest(fixed) && !element.closest(userContent))));
    }

    function lookup(source) {
        if (cache.has(source)) return cache.get(source);
        const common = dictionary.public;
        const localValue = Object.hasOwn(page.static || {}, source) ? page.static[source] : null;
        let result = typeof localValue === 'string' ? localValue :
            (Object.hasOwn(common.static || {}, source) ? common.static[source] : null);
        if (typeof result !== 'string') {
            for (const [pattern, replacement] of [...(page.regexp || []), ...(common.regexp || [])]) {
                try {
                    const next = source.replace(pattern, replacement);
                    if (next !== source) {
                        result = next;
                        break;
                    }
                } catch {
                    // Some upstream contextual rules depend on userscript-only globals.
                }
            }
        }
        if (cache.size >= 1000) cache.clear();
        cache.set(source, result);
        return result;
    }

    function translate(node) {
        if (!owns(node)) return;
        if (changed.get(node)?.rendered === node.data) return;
        changed.delete(node);
        const original = node.data;
        const trimmed = original.trim();
        if (!/[A-Za-z]/.test(trimmed) || trimmed.length > 260) return;
        const source = trimmed.replace(/\s+/g, ' ');
        const value = lookup(source);
        if (!value || value === source) return;
        const rendered = original.replace(trimmed, () => value);
        changed.set(node, { original, rendered });
        node.data = rendered;
    }

    function scan(root) {
        if (!root?.isConnected || !page) return;
        if (root.nodeType === Node.TEXT_NODE) return translate(root);
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        const scopes = root.closest(fixed) ? [root] : [...root.querySelectorAll(fixed)]
            .filter(scope => !scope.parentElement?.closest(fixed));
        for (const scope of scopes) {
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) translate(walker.currentNode);
        }
    }

    function flush() {
        timer = undefined;
        if (!enabled) return;
        if (route !== location.pathname) {
            readRoute();
            queued.clear();
            queued.add(document.body);
        }
        for (const [node, { original, rendered }] of changed) {
            if (node.isConnected && owns(node)) continue;
            if (node.isConnected && node.data === rendered) node.data = original;
            changed.delete(node);
        }
        for (const root of queued) scan(root);
        queued.clear();
    }

    function schedule(node) {
        if (queued.size >= 60) {
            queued.clear();
            queued.add(document.body);
        } else if (node) {
            queued.add(node);
        }
        if (timer === undefined) timer = setTimeout(flush, 0);
    }

    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'characterData') {
                if (changed.get(record.target)?.rendered !== record.target.data) schedule(record.target);
            } else {
                for (const node of record.addedNodes) schedule(node);
                if (record.removedNodes.length && timer === undefined) timer = setTimeout(flush, 0);
            }
        }
    });
    const onNavigation = () => schedule(document.body);

    function setEnabled(next) {
        if (enabled === next) return;
        enabled = next;
        if (!enabled) {
            observer.disconnect();
            globalThis.navigation?.removeEventListener('currententrychange', onNavigation);
            removeEventListener('popstate', onNavigation);
            clearTimeout(timer);
            timer = undefined;
            queued.clear();
            restore();
            return;
        }
        readRoute();
        globalThis.yoreadPage?.release?.(excludes);
        observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
        globalThis.navigation?.addEventListener('currententrychange', onNavigation);
        addEventListener('popstate', onNavigation);
        scan(document.body);
    }

    globalThis.yoreadGitHub = { owns, excludes };
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id || message?.type !== 'content.github') return;
        setEnabled(message.enabled === true);
        respond({ ok: true });
    });
    setEnabled(true);
})();
