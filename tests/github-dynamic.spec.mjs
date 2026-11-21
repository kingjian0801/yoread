import { expect, test } from './browser-fixture.mjs';

test('localizes the repository history count as GitHub updates it', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const history = '/acme/demo/commits/main/';
    fixture.html = `
        <main>
            <a id="history" data-component="LinkButton" href="${history}">
                <span data-component="buttonContent">
                    <span data-component="leadingVisual" aria-hidden="true"><svg></svg></span>
                    <span data-component="text"><span id="count">1 Commit</span></span>
                </span>
            </a>
            <a id="exact" data-component="LinkButton" href="${history}">
                <span data-component="text">History</span>
            </a>
            <a id="unrecognized" class="btn" data-component="LinkButton" href="${history}">
                <span data-component="text"><span>12,34 Commits</span></span>
            </a>
            <a id="missing-count" class="btn" data-component="LinkButton" href="${history}">
                <span data-component="text"><span>Commits</span></span>
            </a>
            <a id="unexpected-shape" class="btn" data-component="LinkButton" href="${history}">
                <span>3 Commits</span>
            </a>
            <a id="another-repo" data-component="LinkButton" href="/acme/another/commits/main/">
                <span data-component="text">3 Commits</span>
            </a>
            <article class="markdown-body">3 Commits</article>
            <output></output>
        </main>
        <script>
            document.querySelector('#history').addEventListener('click', event => {
                event.preventDefault();
                document.querySelector('output').textContent = event.currentTarget.getAttribute('href');
            });
        </script>`;
    const popup = await open('github.com', '/acme/demo');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    const count = page.locator('#count');
    const link = page.locator('#history');
    await expect(count).toHaveText('1 次提交');
    await expect(page.locator('#exact')).toHaveText('历史');

    await count.evaluate(element => { element.firstChild.data = '3 Commits'; });
    await expect(count).toHaveText('3 次提交');
    await count.evaluate(element => {
        const extra = document.createElement('span');
        extra.id = 'extra-slot';
        extra.textContent = 'loading';
        element.after(extra);
    });
    await expect(count).toHaveText('3 Commits');
    await page.locator('#extra-slot').evaluate(element => { element.remove(); });
    await expect(count).toHaveText('3 次提交');
    await expect(page.locator('article')).toHaveText('3 Commits');
    await expect(page.locator('#unrecognized')).toHaveText('12,34 Commits');
    await expect(page.locator('#missing-count')).toHaveText('Commits');
    await expect(page.locator('#unexpected-shape')).toHaveText('3 Commits');
    await expect(page.locator('#another-repo')).toHaveText('3 Commits');
    await count.evaluate(element => {
        window.countWrites = 0;
        new MutationObserver(records => { window.countWrites += records.length; })
            .observe(element, { characterData: true, subtree: true });
    });
    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(popup.locator('#github-status')).toHaveText('已切换到专业档。');
    await expect(count).toHaveText('3 次提交');
    expect(await page.evaluate(() => window.countWrites)).toBe(0);
    await link.click();
    await expect(page.locator('output')).toHaveText(history);
    await expect(link).toHaveAttribute('href', history);
    await expect(link.locator('svg')).toHaveCount(1);

    await count.evaluate(element => { element.textContent = '12,652 Commits'; });
    await expect(count).toHaveText('12,652 次提交');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).uncheck();
    await expect(count).toHaveText('12,652 Commits');
});

test('lets the GitHub time component refresh in Chinese while keeping site updates', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const date = '2026-11-21T00:00:00Z';
    fixture.html = `
        <main lang="en">
            <relative-time id="activity" data-component="RelativeTime" datetime="${date}"></relative-time>
            <relative-time id="late" data-component="RelativeTime">Waiting for date</relative-time>
            <relative-time id="invalid" datetime="unknown">Unknown time</relative-time>
            <article class="markdown-body"><relative-time id="readme-time" datetime="${date}"></relative-time></article>
            <div class="js-full-logs-container"><relative-time id="log-time" datetime="${date}"></relative-time></div>
            <react-partial partial-name="global-nav-bar"><header class="GlobalNav">
                <relative-time id="header-time" datetime="${date}"></relative-time>
            </header></react-partial>
        </main>
        <script>
            let now = Date.parse('2026-11-21T00:02:00Z');
            window.advanceTime = () => { now += 120_000; };
            // Model the upstream component's observed attributes and locale-aware refresh.
            customElements.define('relative-time', class extends HTMLElement {
                static observedAttributes = ['lang', 'datetime'];
                constructor() {
                    super();
                    this.attachShadow({ mode: 'open' }).append(document.createElement('span'));
                }
                connectedCallback() {
                    this.update();
                    this.timer = setInterval(() => this.update(), 50);
                }
                disconnectedCallback() { clearInterval(this.timer); }
                attributeChangedCallback() { this.update(); }
                update() {
                    const date = Date.parse(this.getAttribute('datetime'));
                    if (!Number.isFinite(date)) return;
                    const locale = this.closest('[lang]')?.getAttribute('lang') || 'en';
                    const minutes = Math.trunc((date - now) / 60_000);
                    this.shadowRoot.firstChild.textContent = new Intl.RelativeTimeFormat(locale).format(minutes, 'minute');
                }
            });
        </script>`;
    const popup = await open('github.com', '/acme/demo/pull/1');
    const activity = page.locator('#activity');
    const late = page.locator('#late');
    const readme = page.locator('#readme-time');
    await expect(activity.locator('span')).toHaveText('2 minutes ago');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(activity.locator('span')).toHaveText('2分钟前');
    await expect(readme.locator('span')).toHaveText('2 minutes ago');
    await expect(page.locator('#log-time span')).toHaveText('2 minutes ago');
    const header = page.locator('#header-time span');
    await expect(header).toHaveText('2 minutes ago');
    await page.locator('react-partial').evaluate(element => { element.classList.add('loaded'); });
    await expect(header).toHaveText('2分钟前');
    await expect(page.locator('#invalid')).not.toHaveAttribute('lang', /./);
    await expect(late).not.toHaveAttribute('lang', /./);

    await late.evaluate((element, datetime) => { element.setAttribute('datetime', datetime); }, date);
    await page.evaluate(() => { window.advanceTime(); });
    await expect(activity.locator('span')).toHaveText('4分钟前');
    await expect(late.locator('span')).toHaveText('4分钟前');
    await activity.evaluate(element => { element.lang = 'de'; });
    await expect(activity).toHaveAttribute('lang', 'zh-CN');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).uncheck();
    await expect(activity).toHaveAttribute('lang', 'de');
    await expect(activity.locator('span')).toHaveText('vor 4 Minuten');
    await expect(activity).toHaveAttribute('datetime', date);
    await expect(late).not.toHaveAttribute('lang', /./);
    await expect(late.locator('span')).toHaveText('4 minutes ago');
});

test('restores a reused menu across partial navigation and applies the current mode', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `
        <main>
            <button id="open-menu">Open the menu</button>
            <button id="open-issues">Go to issues</button>
            <button id="change-menu-label">Change the menu label</button>
            <div id="menu-container"></div>
        </main>
        <script>
            const menu = document.createElement('div');
            menu.innerHTML = '<button id="fork" role="menuitem">Fork</button>';
            const container = document.querySelector('#menu-container');
            document.querySelector('#open-menu').onclick = () => container.append(menu);
            document.querySelector('#open-issues').onclick = () => {
                menu.remove();
                history.pushState(null, '', '/acme/demo/issues');
                container.innerHTML = '<button id="new-issue">New issue</button>';
            };
            document.querySelector('#change-menu-label').onclick = () => {
                menu.querySelector('#fork').firstChild.data = 'History';
            };
            window.addEventListener('popstate', () => {
                if (location.pathname === '/acme/demo') container.replaceChildren(menu);
            });
        </script>`;
    const popup = await open('github.com', '/acme/demo');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    const mode = popup.getByRole('combobox', { name: '汉化模式' });
    const fork = page.locator('#fork');
    await toggle.check();
    await page.locator('#open-menu').click();
    await expect(fork).toHaveText('复刻（Fork）');

    await page.locator('#open-issues').click();
    await expect(page.locator('#new-issue')).toHaveText('创建议题');
    await mode.selectOption('professional');
    await page.goBack();
    await expect(page).toHaveURL('https://github.com/acme/demo');
    await expect(fork).toHaveText('Fork');

    await mode.selectOption('beginner');
    await expect(fork).toHaveText('复刻（Fork）');
    await page.locator('#change-menu-label').click();
    await expect(fork).toHaveText('历史');
    await toggle.uncheck();
    await expect(fork).toHaveText('History');
});

test('localizes a previously mounted menu when it becomes visible', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `
        <button id="menu-trigger" aria-controls="menu" onclick="document.querySelector('#menu').toggleAttribute('hidden')">Manage</button>
        <div id="menu" role="menu" hidden>
            <button id="hidden-history" role="menuitem">History</button>
        </div>`;
    const popup = await open('github.com', '/acme/demo');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    const entry = page.locator('#hidden-history');
    await expect(entry).toHaveText('History');
    await expect(entry).toBeHidden();
    await page.locator('#menu-trigger').click();
    await expect(entry).toBeVisible();
    await expect(entry).toHaveText('历史');
    await page.locator('#menu-trigger').click();
    await expect(entry).toBeHidden();
    await expect(entry).toHaveText('History');
});
