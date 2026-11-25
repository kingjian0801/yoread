import { expect, setKey, test, translate } from './browser-fixture.mjs';

const saved = '/issues/views/42';
const dashboard = `
    <main>
        <aside aria-label="Issues">
            <nav>
                <a href="/issues">Created</a>
                <a href="/issues/assigned">Assigned</a>
                <a href="/issues/mentioned">Mentioned</a>
                <h2>Views</h2>
                <button id="new-view" aria-label="New view">+</button>
                <a class="btn" href="${saved}">Open</a>
            </nav>
        </aside>
        <section id="current-view">
            <div data-component="PageHeader">
                <h1 data-component="PH_Title">Created by me</h1>
                <div data-component="PageHeader.Description"></div>
            </div>
            <div role="search">
                <label for="query">Search Issues</label>
                <input id="query" type="text" value="is:issue is:open">
            </div>
            <div data-component="Blankslate.Description"><a href="/search">all of GitHub</a></div>
            <ul data-listview-component="items-list">
                <li>
                    <div data-listview-item-title-container>
                        <a class="btn" href="/acme/demo/issues/2">Open</a>
                    </div>
                    <span data-testid="state-label">Open</span>
                </li>
            </ul>
        </section>
    </main>`;

test('keeps manual webpage translation of linked prose independent of the dashboard UI', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = dashboard + '<article class="markdown-body"><p><a href="/guide">Read the guide.</a></p></article>';
    const popup = await open('github.com', '/issues');
    const prose = page.locator('article a');
    await setKey(popup);
    await translate(popup);
    await expect(prose).toHaveText('译文 · Read the guide.');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(page.getByRole('link', { name: '已创建' })).toBeVisible();
    await expect(prose).toHaveText('译文 · Read the guide.');
    await expect(prose).toHaveAttribute('href', '/guide');
});

test('localizes built-in Issues dashboard navigation without touching custom views or links', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = dashboard + `
        <div id="new-view-panel"></div>
        <script>
            const panel = document.querySelector('#new-view-panel');
            document.querySelector('#new-view').addEventListener('click', () => {
                panel.innerHTML = '<form role="dialog" aria-labelledby="view-title">' +
                    '<h2 id="view-title" data-component="Dialog.Title">Create a view</h2>' +
                    '<label>Title <input></label><label>Description <textarea></textarea></label>' +
                    '<label>Icon <select><option>Circle</option></select></label>' +
                    '<label>Query <input value="is:issue is:open"></label><button>Save view</button></form>';
                panel.querySelector('form').onsubmit = event => {
                    event.preventDefault();
                    const [title, description, , query] = panel.querySelector('form').elements;
                    document.querySelector('a[href="${saved}"]').textContent = title.value;
                    document.querySelector('h1').textContent = title.value;
                    document.querySelector('[data-component="PageHeader.Description"]').textContent = description.value;
                    document.querySelector('#query').value = query.value;
                    history.pushState(null, '', '${saved}');
                    panel.replaceChildren();
                };
            });
        </script>`;
    const popup = await open('github.com', '/issues');
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(page.getByRole('link', { name: '已创建', exact: true })).toHaveAttribute('href', '/issues');
    await expect(page.getByRole('link', { name: '已分配', exact: true })).toHaveAttribute('href', '/issues/assigned');
    await expect(page.getByRole('link', { name: '提及', exact: true })).toHaveAttribute('href', '/issues/mentioned');
    await expect(page.getByRole('heading', { name: '视图', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '由您创建', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建视图' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '搜索议题' })).toHaveValue('is:issue is:open');
    await expect(page.getByRole('link', { name: '所有 GitHub' })).toHaveAttribute('href', '/search');
    await expect(page.getByRole('link', { name: 'Open', exact: true }).first()).toHaveAttribute('href', saved);
    await expect(page.getByRole('link', { name: 'Open', exact: true }).last()).toHaveAttribute('href', '/acme/demo/issues/2');
    await expect(page.getByTestId('state-label')).toHaveText('打开');

    await page.getByRole('button', { name: '新建视图' }).click();
    const editor = page.getByRole('dialog', { name: '新建视图' });
    await editor.getByRole('textbox', { name: '标题' }).fill('Open');
    await editor.getByRole('textbox', { name: '描述' }).fill('No results');
    await expect(editor.getByRole('combobox', { name: '图标' })).toHaveValue('Circle');
    await editor.getByRole('textbox', { name: '查询' }).fill('is:pr is:open');
    await editor.getByRole('button', { name: '保存视图' }).click();
    await expect(page).toHaveURL('https://github.com' + saved);
    await expect(page.getByRole('button', { name: '新建视图' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open', exact: true })).toBeVisible();
    await expect(page.locator('[data-component="PageHeader.Description"]')).toHaveText('No results');
    await expect(page.getByRole('textbox', { name: '搜索议题' })).toHaveValue('is:pr is:open');
});

test('localizes the current GitHub saved-view route and protects custom copy', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const realRoute = '/issues/SSC_kExample_42';
    fixture.html = dashboard
        .replace(saved, realRoute)
        .replace('>Created by me</h1>', '>Open</h1>')
        .replace('data-component="PageHeader.Description"></div>', 'data-component="PageHeader.Description">No results</div>');
    const popup = await open('github.com', realRoute);
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    await expect(page.getByRole('heading', { name: '视图', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open', exact: true })).toBeVisible();
    await expect(page.locator('[data-component="PageHeader.Description"]')).toHaveText('No results');
    await expect(page.getByRole('textbox', { name: '搜索议题' })).toHaveValue('is:issue is:open');
    await toggle.uncheck();
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();
});

test('localizes the saved views heading, icon-button label, and inline GitHub view editor', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `<main>
        <div class="headerRow__example" id="saved-views-header">
            <span class="headerRowText__example">Views</span>
            <button data-component="IconButton" aria-labelledby="add-view"></button>
            <span id="add-view" data-component="Tooltip" aria-hidden="true">Create view</span>
        </div>
        <nav data-component="NavList" aria-labelledby="saved-views-header">
            <a href="/issues/SSC_kExample_42">Open</a>
        </nav>
        <form>
            <label data-component="FormControl.Label">Title <input placeholder="Untitled view" value="Open"></label>
            <label data-component="FormControl.Label">Description <input value="No results"></label>
            <label data-component="FormControl.Label">Query <input value="is:issue is:open"></label>
        </form>
        <article><span data-component="Tooltip" aria-hidden="true">Create view</span></article>
    </main>`;
    const popup = await open('github.com', '/issues/SSC_kExample_42');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    await expect(page.getByText('视图', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建视图' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '标题' })).toHaveValue('Open');
    await expect(page.getByRole('textbox', { name: '描述' })).toHaveValue('No results');
    await expect(page.getByRole('textbox', { name: '查询' })).toHaveValue('is:issue is:open');
    await expect(page.locator('article')).toHaveText('Create view');
    await toggle.uncheck();
    await expect(page.getByRole('button', { name: 'Create view' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('No results');
});

test('applies dashboard filters, edits a saved view, and restores the latest UI text', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = dashboard
        .replace('>Created by me</h1>', '>Open</h1>')
        .replace('data-component="PageHeader.Description"></div>', 'data-component="PageHeader.Description">No results</div>')
        .replace('<ul data-listview-component=', `
            <div data-listview-component="header"><span id="results">1,234 results</span></div>
            <button id="filters" aria-label="Filters">Filters</button>
            <button id="view-options" aria-label="View options">...</button>
            <div id="overlay"></div>
            <ul data-listview-component=`)
        .concat(`
        <script>
            const overlay = document.querySelector('#overlay');
            const query = document.querySelector('#query');
            document.querySelector('#filters').addEventListener('click', () => {
                overlay.innerHTML = '<div role="menu">' +
                    '<button role="menuitemcheckbox" aria-checked="false">Closed</button>' +
                    '</div>';
                overlay.querySelector('button').addEventListener('click', () => {
                    query.value = 'is:issue is:closed';
                    document.querySelector('#results').textContent = '17 results';
                    document.querySelector('[data-testid="state-label"]').textContent = 'Closed';
                    overlay.replaceChildren();
                });
            });
            document.querySelector('#view-options').addEventListener('click', () => {
                overlay.innerHTML = '<div role="menu">' +
                    '<button role="menuitem">Edit view</button><button role="menuitem">Duplicate</button>' +
                    '<button role="menuitem">Delete</button></div>';
                overlay.querySelector('button').addEventListener('click', () => {
                    overlay.innerHTML =
                        '<div role="dialog" aria-labelledby="edit-title">' +
                        '<h2 data-component="Dialog.Title" id="edit-title">Edit view</h2>' +
                        '<form><label>Title <input value="Open"></label>' +
                        '<label>Description <textarea>No results</textarea></label>' +
                        '<label>Query <input value="' + query.value + '"></label>' +
                        '<button type="submit">Save view</button></form></div>';
                    overlay.querySelector('form').addEventListener('submit', event => {
                        event.preventDefault();
                        const title = overlay.querySelector('input').value;
                        document.querySelector('h1').textContent = title;
                        document.querySelector('a[href="${saved}"]').textContent = title;
                        overlay.replaceChildren();
                    });
                });
            });
        </script>`);
    const popup = await open('github.com', saved);
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    await expect(page.getByRole('heading', { name: 'Open' })).toBeVisible();
    await expect(page.locator('[data-component="PageHeader.Description"]')).toHaveText('No results');
    await expect(page.locator('#results')).toHaveText('1,234 个结果');

    await page.getByRole('button', { name: '筛选', exact: true }).click();
    const choice = page.getByRole('menuitemcheckbox', { name: '已关闭' });
    await expect(choice).toBeVisible();
    await choice.click();
    await expect(page.locator('#query')).toHaveValue('is:issue is:closed');
    await expect(page.locator('#results')).toHaveText('17 个结果');
    await expect(page.getByTestId('state-label')).toHaveText('已关闭');

    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(popup.locator('#github-status')).toHaveText('已切换到专业档。');
    await page.getByRole('button', { name: '视图选项' }).click();
    await expect(page.getByRole('menuitem', { name: '复制' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '删除' })).toBeVisible();
    await page.getByRole('menuitem', { name: '编辑视图' }).click();
    const editor = page.getByRole('dialog', { name: '编辑视图' });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('textbox', { name: '标题' })).toHaveValue('Open');
    await expect(editor.getByRole('textbox', { name: '描述' })).toHaveValue('No results');
    await expect(editor.getByRole('textbox', { name: '查询' })).toHaveValue('is:issue is:closed');
    await editor.getByRole('textbox', { name: '标题' }).fill('Created');
    await editor.getByRole('button', { name: '保存视图' }).click();
    await expect(page.getByRole('heading', { name: 'Created', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Created', exact: true })).toHaveAttribute('href', saved);

    await toggle.uncheck();
    await expect(page.locator('#results')).toHaveText('17 results');
    await expect(page.getByTestId('state-label')).toHaveText('Closed');
    await expect(page.locator('#query')).toHaveValue('is:issue is:closed');
    await expect(page.getByRole('heading', { name: 'Created', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View options' })).toBeVisible();
});
