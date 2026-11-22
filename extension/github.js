/* SPDX-License-Identifier: GPL-3.0-or-later */
(() => {
    if (globalThis.yoreadGitHub || location.origin !== 'https://github.com') return;
    const upstream = globalThis.I18N;
    const dictionary = upstream?.['zh-CN'];
    if (!dictionary) return;

    const reactHeader = 'react-partial[partial-name="global-nav-bar"], react-partial[partial-name="marketing-header"]';
    const globalHeader = `.AppHeader, header.GlobalNav, ${reactHeader}`;
    const pendingSearch = 'qbsearch-input:not(:defined)';
    const headerLabelControls = 'header[aria-label], button[aria-label]';
    const repositoryNav = 'nav[aria-label="Repository"], nav[aria-label="Repository navigation"], nav[data-testid="repository-navbar"]';
    const commitHistoryControl = 'a[data-component="LinkButton"][href*="/commits/"]';
    const commitHistoryLabel = ':scope > [data-component="text"], :scope > [data-component="buttonContent"] > [data-component="text"]';
    const commitCount = /^(?:\d+|\d{1,3}(?:,\d{3})+) [Cc]ommits?$/;
    const relativeTime = 'relative-time[datetime]';
    const localizedLanguage = 'zh-CN';
    const contextAttributes = ['hidden', 'inert', 'aria-hidden', 'translate', 'href'];
    const fixed = [
        globalHeader, repositoryNav, '.UnderlineNav', '.tabnav-tabs',
        'a[data-dd-action-name^="pull_requests.navigation."]',
        '#repository-container-header', 'button', 'summary', '[role="button"]',
        'a.btn', 'a.Button', 'a[href$="/issues/new"]', 'a[href$="/issues/new/choose"]',
        '[role="tab"]', '[role="menuitem"]', '[role="menuitemcheckbox"]',
        '.State', '.StateLabel', '[data-testid="issue-state-badge"]',
        '[data-testid="state-label"]', '[class*="StateLabel"]', commitHistoryControl,
    ].join(',');
    const actionsRoute = /^\/[^/]+\/[^/]+\/actions(?:\/workflows\/[^/]+|\/runs\/\d+(?:\/attempts\/\d+)?(?:\/job\/\d+)?)?\/?$/;
    const actionsList = 'react-app [data-listview-component="items-list"]';
    const actionsFilter = 'react-app search[class^="FilterBar__"]';
    const actionsFilterTitle = '[data-component="SelectPanel.Title"]';
    const actionsFilterOption = '[data-component="SelectPanel"] [role="option"] [data-component="ActionList.Item.Label"]';
    const actionsAnnotations = '[data-url$="/annotations_partial"]';
    const actionsFixed = [
        'react-app [data-component="PH_Title"]', 'react-app [data-component="PageHeader.Description"]',
        'react-app [data-component="Sidebar.Item"]', 'react-app h2[id$="-list-view-container-title"]',
        `${actionsFilter} label`, actionsFilterTitle, actionsFilterOption, `${actionsList} .sr-only`,
        '.actions-workflow-stats > div > div > span', '.actions-workflow-stats .col-triggered-content span',
        `${actionsAnnotations} h2`,
    ].join(',');
    const actionsProtected = [
        '[data-listview-item-title-container]', `${actionsList} strong`, '.PageHeader-parentLink',
        '.WorkflowJob-title', 'action-graph', 'annotation-message',
        '.js-full-logs-container', '[role="log"]', '.terminal', 'table.highlight',
    ].join(',');
    const actionsLabels = [
        actionsFilter, `${actionsFilter} [role="form"]`, 'react-app nav[data-component="Sidebar.Main"]',
        'react-app section[aria-label]', 'react-app [role="group"][aria-label]',
        'react-app [data-component="ActionBar"] [role="toolbar"]', `${actionsList} li[aria-label]`,
        '.actions-workflow-stats', actionsAnnotations,
    ].join(',');
    const actionsLabelTerms = {
        'Workflow run filters': '工作流运行筛选',
        'Workflow runs results': '工作流运行结果',
        'Workflow run summary': '工作流运行摘要',
    };
    const userContent = [
        'article', '.markdown-body', '.js-comment-body', '.comment-body',
        '.js-issue-title', '.markdown-title', '[data-testid="issue-title"]',
        '[data-testid="issue-body"]', '[data-testid="comment-body"]',
    ].join(',');
    const identifiers = [
        '.AppHeader-context', '.branch-name', '[class*="branchName"]',
        '.commit-ref', '[class*="CommitRef"]',
        '[data-testid*="branch"]', '[data-testid*="ref-name"]',
        '#ref-picker-repos-header-ref-selector', '.commit-author',
        '.commit-title', '.sha', '[data-commit-sha]',
        'a[data-hovercard-type="user"]', 'a[data-hovercard-type="repository"]',
        '.user-mention', '.author', '.repo-and-owner', '.react-directory-filename-column',
        'nav[data-component="Breadcrumbs"]', 'a[href*="/commit/"]',
        'strong[itemprop="name"]', '[data-testid="repository-name"]',
    ].join(',');
    const protectedContexts = [
        userContent, identifiers,
        'input', 'textarea', 'select', 'option', '[contenteditable]',
        'script', 'style', 'template', 'code', 'pre', 'kbd', 'samp', 'svg',
        '[hidden]', '[inert]', '[aria-hidden="true"]', '[translate="no"]',
    ].join(',');
    const protectedContent = `${protectedContexts},relative-time`;
    const changed = new Map();
    const changedLabels = new Map();
    const changedTimes = new Map();
    const queued = new Set();
    const cache = new Map();
    let enabled = false;
    let showingOriginal = false;
    let mode = 'beginner';
    let terms = globalThis.yoreadGitHubTerms;
    let receivedUpdate = false;
    let route;
    let pageKey;
    let page;
    let repoPath;
    let fixedForRoute = fixed;
    let ignore;
    let timer;
    let searchTimer;

    function readRoute() {
        clearTimeout(searchTimer);
        searchTimer = undefined;
        if (route !== location.pathname) showingOriginal = false;
        restore();
        cache.clear();
        route = location.pathname;
        const [owner, repo, section] = route.split('/').filter(Boolean);
        const kind = route.match(upstream.conf.rePagePathRepo)?.[1];
        const actions = kind === 'actions' && actionsRoute.test(route);
        const supported = !section || actions || (section === kind && ['issues', 'pull', 'pulls'].includes(kind));
        const reserved = owner && ('/' + owner.toLowerCase() + '/').match(upstream.conf.rePagePath)?.[1] === owner.toLowerCase();
        pageKey = kind ? `repository/${kind}` : 'repository';
        page = owner && repo && !reserved && supported ? dictionary[pageKey] : null;
        repoPath = page ? `/${owner}/${repo}`.toLowerCase() : '';
        fixedForRoute = actions ? `${fixed},${actionsFixed}` : fixed;
        // The upstream feature varies these exclusions by page and combines its global entries.
        const skip = upstream.conf.ignoreSelectorPage;
        ignore = [...(skip['*'] || []), ...(skip[pageKey] || [])].join(',');
    }

    function restore() {
        for (const [node, { original, rendered }] of changed) {
            if (node.data === rendered) node.data = original;
        }
        changed.clear();
        for (const [element, change] of changedLabels) restoreAttribute(element, 'aria-label', change);
        changedLabels.clear();
        for (const [element, change] of changedTimes) restoreAttribute(element, 'lang', change);
        changedTimes.clear();
    }

    function restoreAttribute(element, attribute, { original, rendered }) {
        if (element.getAttribute(attribute) !== rendered) return;
        if (original === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, original);
    }

    function headerReady(header) {
        // GitHub's react-partial adds "loaded" after the React commit.
        const partial = header.closest(reactHeader);
        return partial ? partial.classList.contains('loaded') : document.readyState === 'complete';
    }

    function isIdentifier(element) {
        if (pageKey === 'repository/actions') {
            if (element.closest(actionsProtected)) return true;
            if (element.closest('[data-component="PH_Title"]') &&
                route.slice(repoPath.length).startsWith('/actions/workflows/')) return true;
            if (element.closest(actionsFilterOption)) {
                const title = element.closest('[data-component="SelectPanel"]').querySelector(actionsFilterTitle)?.firstChild;
                const previous = changed.get(title);
                const original = previous && previous.rendered === title.data ? previous.original : title?.data;
                if (original !== 'Filter by Status' && original !== 'Filter by Event') return true;
            }
            const actionLink = element.closest('a[href]');
            if (actionLink?.origin === location.origin && actionLink.pathname.toLowerCase().startsWith(repoPath + '/actions/')) {
                const actionPath = actionLink.pathname.slice(repoPath.length);
                if (/^\/actions\/(?:workflows\/[^/]+|runs\/\d+(?:\/attempts\/\d+)?\/job\/\d+)\/?$/.test(actionPath)) return true;
            }
        }
        const link = element.closest('a[href]');
        if (!link) return false;
        const path = link.pathname.toLowerCase().replace(/\/+$/, '');
        if (link.origin !== location.origin || !path.startsWith(repoPath + '/')) {
            // GitHub marks its Code tab, which can share a label and URL with the repository name.
            return path !== repoPath || !/^(?:Code|代码)$/.test(link.textContent.trim()) ||
                (path.split('/').at(-1) === 'code' &&
                    (link.origin !== location.origin || link.dataset.tabItem !== 'code'));
        }
        return /^\/(?:tree|commit|blob|releases\/tag|compare)\//.test(path.slice(repoPath.length));
    }

    function owns(node) {
        if (!enabled) return false;
        if (route !== location.pathname) readRoute();
        if (showingOriginal) return false;
        const element = node.parentElement;
        if (!page || !element?.closest(fixedForRoute) || element.closest(protectedContent) ||
            isIdentifier(element)) return false;
        const history = element.closest(commitHistoryControl);
        if (history) {
            const label = history.querySelector(commitHistoryLabel);
            if (pageKey !== 'repository' || !history.pathname.toLowerCase().startsWith(repoPath + '/commits/') ||
                !label?.contains(node) || label.textContent.trim() !== node.data.trim()) return false;
        }
        const header = element.closest(globalHeader);
        if (header && (element.closest(pendingSearch) ||
            (!element.closest(repositoryNav) && !headerReady(header)))) return false;
        return !ignore || !element.closest(ignore);
    }

    function excludes(node) {
        if (!enabled) return false;
        if (route !== location.pathname) readRoute();
        const element = node.parentElement;
        return Boolean(page && element && (element.closest(identifiers) || element.closest('relative-time') ||
            (pageKey === 'repository/actions' && isIdentifier(element)) ||
            (element.closest(fixedForRoute) && !element.closest(userContent))));
    }

    function lookup(source, exactOnly = false) {
        const scopedTerms = globalThis.yoreadGitHubPageTerms?.[pageKey];
        for (const entries of [scopedTerms, terms]) {
            if (!entries || !Object.hasOwn(entries, source)) continue;
            const override = entries[source][mode];
            if (typeof override === 'string') return override;
        }
        const common = dictionary.public;
        const localValue = Object.hasOwn(page.static || {}, source) ? page.static[source] : null;
        let result = typeof localValue === 'string' ? localValue :
            (Object.hasOwn(common.static || {}, source) ? common.static[source] : null);
        if (typeof result === 'string' || exactOnly) return result;
        if (cache.has(source)) return cache.get(source);
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
        if (cache.size >= 1000) cache.clear();
        cache.set(source, result);
        return result;
    }

    function translate(node, refreshTerms = false) {
        if (!owns(node)) return;
        const previous = changed.get(node);
        const stillLocalized = previous?.rendered === node.data;
        if (stillLocalized && !refreshTerms) return;
        const original = stillLocalized ? previous.original : node.data;
        changed.delete(node);
        const trimmed = original.trim();
        if (!/[A-Za-z]/.test(trimmed) || trimmed.length > 260) return;
        const source = trimmed.replace(/\s+/g, ' ');
        const element = node.parentElement;
        const separateCountLabel = element.closest(commitHistoryControl);
        const actionPage = pageKey === 'repository/actions';
        const exactOnly = (separateCountLabel && !commitCount.test(source)) ||
            (actionPage && element.closest(actionsFilterOption));
        const value = actionPage && element.matches('.sr-only') && element.closest(actionsList)
            ? translateActionStatus(source)
            : lookup(source, Boolean(exactOnly));
        const rendered = value && value !== source ? original.replace(trimmed, () => value) : original;
        if (rendered !== original) changed.set(node, { original, rendered });
        if (node.data !== rendered) node.data = rendered;
    }

    function ownsLabel(element) {
        if (pageKey === 'repository/actions' && element.matches(actionsLabels) &&
            !element.closest(protectedContent) && (!ignore || !element.closest(ignore))) return true;
        const header = element.closest(globalHeader);
        return page && header && headerReady(header) && element.matches(headerLabelControls) &&
            !element.closest(protectedContent) && !element.closest(pendingSearch) &&
            (!ignore || !element.closest(ignore));
    }

    function translateActionStatus(source) {
        const match = /^([a-z ]+):(.*)$/s.exec(source);
        if (!match) return null;
        const status = lookup(match[1], true);
        return status ? `${status}：${match[2]}` : null;
    }

    function translateLabel(element) {
        if (!ownsLabel(element)) return;
        const original = element.getAttribute('aria-label');
        if (changedLabels.get(element)?.rendered === original) return;
        changedLabels.delete(element);
        const headerLabels = globalThis.yoreadGitHubHeaderLabels;
        let rendered;
        if (pageKey === 'repository/actions' && element.matches(actionsLabels)) {
            if (element.matches('li')) rendered = translateActionStatus(original);
            else rendered = Object.hasOwn(actionsLabelTerms, original) ? actionsLabelTerms[original] : lookup(original, true);
        } else if (headerLabels && Object.hasOwn(headerLabels, original)) {
            rendered = headerLabels[original];
        }
        if (!rendered || rendered === original) return;
        changedLabels.set(element, { original, rendered });
        element.setAttribute('aria-label', rendered);
    }

    function ownsTime(element) {
        if (!page || !element.matches(relativeTime) || element.closest(protectedContexts) ||
            (ignore && element.closest(ignore)) || !Number.isFinite(Date.parse(element.getAttribute('datetime')))) {
            return false;
        }
        const header = element.closest(globalHeader);
        return !header || headerReady(header);
    }

    function localizeTime(element) {
        if (!ownsTime(element)) return;
        const original = element.getAttribute('lang');
        if (original === localizedLanguage) return;
        // Let GitHub's component format, update and describe the timestamp itself.
        changedTimes.set(element, { original, rendered: localizedLanguage });
        element.setAttribute('lang', localizedLanguage);
    }

    function scan(root, refreshTerms = false) {
        if (showingOriginal || !root?.isConnected || !page) return;
        if (root.nodeType === Node.TEXT_NODE) return translate(root, refreshTerms);
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        if (root.matches(relativeTime)) localizeTime(root);
        for (const time of root.querySelectorAll(relativeTime)) localizeTime(time);
        if (pageKey === 'repository/actions') {
            if (root.matches(actionsLabels)) translateLabel(root);
            for (const element of root.querySelectorAll(actionsLabels)) translateLabel(element);
        }
        const scopes = root.closest(fixedForRoute) ? [root] : [...root.querySelectorAll(fixedForRoute)]
            .filter(scope => !scope.parentElement?.closest(fixedForRoute));
        for (const scope of scopes) {
            const header = scope.closest(globalHeader);
            if (header && headerReady(header)) {
                const search = scope.closest(pendingSearch) ?? scope.querySelector(pendingSearch);
                if (search) waitForSearch(search);
                if (scope.matches(headerLabelControls)) translateLabel(scope);
                for (const element of scope.querySelectorAll(headerLabelControls)) translateLabel(element);
            }
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) translate(walker.currentNode, refreshTerms);
        }
    }

    function waitForSearch(element) {
        if (searchTimer !== undefined) return;
        // A content script cannot observe the page's custom-element registry directly.
        const deadline = Date.now() + 15_000;
        function check() {
            searchTimer = undefined;
            if (!enabled || !element.isConnected) return;
            if (element.matches(':defined')) schedule(element);
            else if (Date.now() < deadline) searchTimer = setTimeout(check, 80);
        }
        searchTimer = setTimeout(check, 80);
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
            if (node.data === rendered) node.data = original;
            changed.delete(node);
        }
        for (const [element, change] of changedLabels) {
            if (element.isConnected && ownsLabel(element)) continue;
            restoreAttribute(element, 'aria-label', change);
            changedLabels.delete(element);
        }
        for (const [element, change] of changedTimes) {
            if (element.isConnected && ownsTime(element)) continue;
            restoreAttribute(element, 'lang', change);
            changedTimes.delete(element);
        }
        for (const root of queued) scan(root);
        queued.clear();
    }

    function schedule(node) {
        if (showingOriginal && route === location.pathname) return;
        if (queued.size >= 60) {
            queued.clear();
            queued.add(document.body);
        } else if (node) {
            queued.add(node);
        }
        if (timer === undefined) timer = setTimeout(flush, 0);
    }

    const observer = new MutationObserver(records => {
        if (showingOriginal && route === location.pathname) return;
        for (const record of records) {
            if (record.type === 'characterData') {
                if (changed.get(record.target)?.rendered !== record.target.data) schedule(record.target);
            } else if (record.type === 'attributes') {
                if (record.attributeName === 'class' && record.target.matches(reactHeader)) {
                    schedule(record.target);
                } else if (record.attributeName === 'aria-label' &&
                    (changedLabels.has(record.target) ||
                        (pageKey === 'repository/actions' && record.target.matches(actionsLabels)) ||
                        (record.target.matches(headerLabelControls) && record.target.closest(globalHeader))) &&
                    changedLabels.get(record.target)?.rendered !== record.target.getAttribute('aria-label')) {
                    schedule(record.target);
                } else if (record.target.matches('relative-time') && (record.attributeName === 'datetime' ||
                    (record.attributeName === 'lang' &&
                        changedTimes.get(record.target)?.rendered !== record.target.getAttribute('lang')))) {
                    schedule(record.target);
                } else if (contextAttributes.includes(record.attributeName)) {
                    schedule(record.target);
                }
            } else {
                if (record.removedNodes.length && record.target.closest?.(commitHistoryControl)) {
                    // The surviving count can become eligible when its label loses a sibling.
                    schedule(record.target);
                } else {
                    for (const node of record.addedNodes) schedule(node);
                    if (record.removedNodes.length && timer === undefined) timer = setTimeout(flush, 0);
                }
            }
        }
    });
    const onNavigation = () => schedule(document.body);
    const onHeaderReady = () => {
        if (enabled) document.querySelectorAll(globalHeader).forEach(schedule);
    };

    function resetRendering() {
        clearTimeout(timer);
        clearTimeout(searchTimer);
        timer = undefined;
        searchTimer = undefined;
        queued.clear();
        cache.clear();
        restore();
    }

    function togglePageOriginal(event) {
        if (event.code !== 'KeyY' || !event.ctrlKey || !event.shiftKey ||
            event.altKey || event.metaKey || event.defaultPrevented ||
            event.repeat || event.isComposing || event.keyCode === 229) return;
        const editor = 'input,textarea,select,[role="textbox"],[role="searchbox"],[role="combobox"],[role="spinbutton"]';
        if (event.composedPath().some(target =>
            target instanceof Element && (target.isContentEditable || target.matches(editor)))) return;
        if (route !== location.pathname) readRoute();
        if (!page) return;

        event.preventDefault();
        showingOriginal = !showingOriginal;
        if (showingOriginal) resetRendering();
        else scan(document.body);
    }

    function setLocalization(next, nextMode = mode) {
        const selection = nextMode === 'professional' ? 'professional' : 'beginner';
        const modeChanged = mode !== selection;
        const nextTerms = globalThis.yoreadGitHubTerms;
        const termsChanged = terms !== nextTerms;
        terms = nextTerms;
        mode = selection;
        if (enabled === next) {
            if (enabled && (modeChanged || termsChanged)) scan(document.body, true);
            return;
        }
        enabled = next;
        if (!enabled) {
            observer.disconnect();
            removeEventListener('keydown', togglePageOriginal);
            removeEventListener('load', onHeaderReady);
            globalThis.navigation?.removeEventListener('currententrychange', onNavigation);
            removeEventListener('popstate', onNavigation);
            showingOriginal = false;
            resetRendering();
            return;
        }
        readRoute();
        globalThis.yoreadPage?.release?.(excludes);
        observer.observe(document.documentElement, {
            subtree: true, childList: true, characterData: true,
            attributeFilter: ['class', 'aria-label', 'datetime', 'lang', ...contextAttributes],
        });
        if (document.readyState !== 'complete') addEventListener('load', onHeaderReady, { once: true });
        globalThis.navigation?.addEventListener('currententrychange', onNavigation);
        addEventListener('popstate', onNavigation);
        addEventListener('keydown', togglePageOriginal);
        scan(document.body);
    }

    globalThis.yoreadGitHub = { owns, excludes };
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id || message?.type !== 'content.github') return;
        receivedUpdate = true;
        setLocalization(message.enabled === true, message.mode);
        respond({ ok: true });
    });

    async function initialize() {
        let settings;
        try {
            settings = await chrome.runtime.sendMessage({ type: 'github.mode.get' });
        } catch {
            // Older extension controllers use the default terminology.
        }
        if (!receivedUpdate) setLocalization(settings?.enabled !== false, settings?.mode);
    }
    void initialize();
})();
