import { test, expect } from './browser-fixture.mjs';

test('waits for the GitHub global header to initialize on the first visit after restart', { tag: '@popup' }, async ({ browserApp }) => {
    const { fixture, open, openPopup, restart } = browserApp;
    const path = '/acme/demo';
    fixture.html = request => request.url.startsWith('/search?') ? '<h1>Search results</h1>' : `
        <style>
            header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
            dialog { max-width: calc(100vw - 48px); }
        </style>
        <react-partial partial-name="global-nav-bar" data-ssr="true">
            <div data-target="react-partial.reactRoot">
                <header class="GlobalNav AppHeader" aria-label="Global navigation menu">
                    <div class="AppHeader-globalBar">
                        <button id="quick-search" aria-label="Open quick search dialog, type / to search"
                            aria-controls="search-suggestions-dialog" aria-haspopup="dialog" aria-expanded="false">
                            <span>Quick search</span><kbd aria-hidden="true">/</kbd>
                        </button>
                    </div>
                    <nav aria-label="Repository">
                        <a href="/acme/demo" data-tab-item="code">Code</a>
                    </nav>
                </header>
            </div>
        </react-partial>
        <dialog id="search-suggestions-dialog" aria-label="Search suggestions">
            <form action="/search" method="get">
                <input id="query" name="q" aria-label="Search query">
                <button aria-label="Search" type="submit">Search</button>
                <a href="/search/advanced">Advanced search</a>
            </form>
        </dialog>
        <main>
            <nav aria-label="Repository navigation"><a data-tab-item="code" href="/acme/demo">Code</a></nav>
            <textarea aria-label="Comment draft">Settings</textarea>
        </main>
        <script>
            fetch('/fixture-header-init').then(async response => {
                if (!response.ok) return;
                await response.text();
                const trigger = document.querySelector('#quick-search');
                // Model React discarding mismatched server-rendered search controls.
                if (trigger.querySelector('span').textContent !== 'Quick search') {
                    trigger.remove();
                    return;
                }
                function showSearch() {
                    document.querySelector('#search-suggestions-dialog').showModal();
                    trigger.setAttribute('aria-expanded', 'true');
                    document.querySelector('#query').focus();
                }
                trigger.addEventListener('click', showSearch);
                document.addEventListener('keydown', event => {
                    if (event.key === '/' && !event.target.closest('textarea,input')) {
                        event.preventDefault();
                        showSearch();
                    }
                });
                trigger.closest('react-partial').classList.add('loaded');
            });
        </script>`;

    const popup = await open('github.com', path);
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(popup.locator('#github-status')).toContainText('已开启');

    const page = await restart();
    await page.setViewportSize({ width: 320, height: 660 });
    const initialization = Promise.withResolvers();
    await page.route('**/fixture-header-init', async route => {
        await initialization.promise;
        await route.fulfill({ status: 200, body: 'ready' });
    });

    try {
        await page.goto('https://github.com' + path);
        await expect(page.locator('main [data-tab-item="code"]')).toHaveText('代码');
        const trigger = page.locator('#quick-search');
        await expect(trigger.locator('span')).toHaveText('Quick search');
        await expect(trigger).toHaveAccessibleName('Open quick search dialog, type / to search');

        initialization.resolve();
        await expect(trigger.locator('span')).toHaveText('快速搜索');
        await expect(trigger).toHaveAccessibleName('打开快速搜索对话框，键入 / 搜索');
        await expect(page.getByRole('banner')).toHaveAccessibleName('全局导航菜单');
        await expect(trigger).toBeInViewport();
        await expect(trigger).toHaveAttribute('aria-controls', 'search-suggestions-dialog');
        const draft = page.locator('textarea[aria-label="Comment draft"]');
        await expect(draft).toHaveValue('Settings');
        await draft.fill('Pull requests');

        await trigger.focus();
        await page.keyboard.press('/');
        const field = page.getByRole('textbox', { name: 'Search query' });
        await expect(field).toBeFocused();
        await expect(page.getByRole('link', { name: 'Advanced search' })).toHaveAttribute('href', '/search/advanced');
        await field.pressSequentially('repo:acme/demo Settings');
        await expect(field).toHaveValue('repo:acme/demo Settings');
        const reopened = await openPopup();
        const toggle = reopened.getByRole('switch', { name: 'GitHub 界面汉化' });
        await toggle.uncheck();
        await expect(trigger.locator('span')).toHaveText('Quick search');
        await expect(trigger).toHaveAccessibleName('Open quick search dialog, type / to search');
        await toggle.check();
        await expect(trigger).toHaveAccessibleName('打开快速搜索对话框，键入 / 搜索');
        await expect(field).toHaveValue('repo:acme/demo Settings');
        await expect(draft).toHaveValue('Pull requests');
        await field.press('Enter');
        await expect(page).toHaveURL('https://github.com/search?q=repo%3Aacme%2Fdemo+Settings');
    } finally {
        initialization.resolve();
    }
});
