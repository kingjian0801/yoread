import { expect, test } from './browser-fixture.mjs';

const actions = '/acme/demo/actions';
const workflow = actions + '/workflows/lint.yml';
const run = actions + '/runs/44577807157';
const job = run + '/job/125787033727';

test('localizes Actions filters and finds a failed run without changing identifiers', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const list = `
        <main>
            <react-app app-name="actions-workflows">
                <nav data-component="Sidebar.Main" aria-label="Workflows">
                    <div data-component="Sidebar.Item"><a href="${actions}">All workflows</a></div>
                    <div data-component="Sidebar.Item"><a href="${workflow}" class="btn">Status</a></div>
                </nav>
                <div data-component="PageHeader">
                    <h1 data-component="PH_Title">All workflows</h1>
                    <div data-component="PageHeader.Description">Showing runs from all workflows</div>
                </div>
                <search class="FilterBar__fixture" aria-label="Filter workflow runs">
                    <label for="query">Filter workflow runs</label>
                    <input id="query" role="combobox" value="is:failure">
                </search>
                <section aria-label="Workflow runs">
                    <div role="group" aria-label="Workflow runs results">
                        <h2 data-component="Heading" id="gh-list-view-container-title">Workflow runs</h2>
                        <div data-component="ActionBar">
                            <div role="toolbar" aria-label="Workflow run filters">
                                <button id="status-filter" type="button">Status</button>
                                <div id="status-choices"></div>
                            </div>
                        </div>
                        <ul data-listview-component="items-list">
                            <li aria-label="failed: Run 18284 of Status. Failure">
                                <span class="sr-only">failed:</span>
                                <div data-listview-item-title-container><a href="${run}">Failure</a></div>
                                <strong>Status</strong>
                                <a class="branch-name" href="/acme/demo/tree/Failure">Failure</a>
                            </li>
                        </ul>
                    </div>
                </section>
            </react-app>
        </main>
        <script>
            document.querySelector('#status-filter').addEventListener('click', () => {
                const panel = document.createElement('div');
                panel.setAttribute('data-component', 'SelectPanel');
                panel.setAttribute('role', 'dialog');
                panel.setAttribute('aria-labelledby', 'filter-status-title');
                panel.innerHTML = '<h1 id="filter-status-title" data-component="SelectPanel.Title">Filter by Status</h1>' +
                    '<ul role="listbox"><li role="option" data-id="failure">' +
                    '<span data-component="ActionList.Item.Label">Failure</span></li></ul>';
                const choice = panel.querySelector('[role="option"]');
                choice.addEventListener('click', () => {
                    document.querySelector('#query').value = 'is:failure branch:main';
                });
                document.querySelector('#status-choices').append(panel);
            });
        </script>`;
    const details = `
        <main>
            <page-header><div class="PageHeader-parentLink"><a href="${workflow}" class="btn">Status</a></div>
                <h1><span class="markdown-title">Failure</span> #18284</h1>
            </page-header>
            <div id="run-summary" role="region" aria-label="Workflow run summary" class="actions-workflow-stats">
                <div><div><span class="text-small">Status</span><span id="conclusion" class="h4">Failure</span></div>
                    <div><span class="text-small">Total duration</span> <a id="sha" href="/acme/demo/commit/abc1234">abc1234</a></div>
                </div>
            </div>
            <div role="region" data-url="${run}/annotations_partial" aria-label="Annotations"><h2>Annotations</h2></div>
            <a id="job-link" class="btn" href="${job}">Failure</a>
            <a id="run-link" href="${run}" class="btn">Summary</a>
            <div class="js-full-logs-container"><button>Failure</button><span>Failure</span><code>Failure</code></div>
            <action-graph><button id="graph-job">Failure</button></action-graph>
            <div class="terminal"><button>Failure</button></div>
            <pre>Failure</pre>
        </main>`;
    fixture.html = ({ url }) => {
        if (url.startsWith(run)) return details;
        if (url === workflow) return list.replace('data-component="PH_Title">All workflows', 'data-component="PH_Title">Status');
        return list;
    };
    const popup = await open('github.com', actions);
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    await expect(page.getByRole('heading', { name: '全部工作流' })).toBeVisible();
    await expect(page.getByRole('link', { name: '全部工作流' })).toHaveAttribute('href', actions);
    await expect(page.getByRole('link', { name: 'Status' })).toHaveAttribute('href', workflow);
    await expect(page.getByRole('search', { name: '筛选工作流' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '筛选工作流' })).toHaveValue('is:failure');
    await expect(page.getByRole('region', { name: '工作流运行', exact: true })).toBeVisible();
    const status = page.getByRole('button', { name: '状态', exact: true });
    await status.click();
    const dialog = page.getByRole('dialog', { name: '按状态筛选' });
    await dialog.getByRole('option', { name: '失败' }).click();
    await expect(page.locator('#query')).toHaveValue('is:failure branch:main');
    const row = page.locator('[data-listview-component="items-list"] li');
    await expect(row.locator('.sr-only')).toHaveText('失败：');
    await expect(row).toHaveAttribute('aria-label', '失败： Run 18284 of Status. Failure');
    await expect(row.locator('strong')).toHaveText('Status');
    await row.evaluate(element => element.setAttribute('aria-label', 'in progress: Run 18284 of Status. Failure'));
    await expect(row).toHaveAttribute('aria-label', '正在进行中： Run 18284 of Status. Failure');
    await toggle.uncheck();
    await expect(row).toHaveAttribute('aria-label', 'in progress: Run 18284 of Status. Failure');
    await expect(page.getByRole('search', { name: 'Filter workflow runs' })).toBeVisible();
    await toggle.check();
    await expect(page.locator('.branch-name')).toHaveText('Failure');

    await row.locator('[data-listview-item-title-container] a').click();
    await expect(page).toHaveURL(`https://github.com${run}`);
    await expect(page.locator('#run-summary')).toContainText('状态');
    await expect(page.locator('#conclusion')).toHaveText('失败');
    await expect(page.getByRole('heading', { name: '说明' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Failure #18284' })).toBeVisible();
    await expect(page.locator('.PageHeader-parentLink a')).toHaveText('Status');
    await expect(page.locator('#sha')).toHaveText('abc1234');
    await expect(page.locator('#job-link')).toHaveText('Failure');
    await expect(page.locator('#graph-job')).toHaveText('Failure');
    await expect(page.locator('.js-full-logs-container button')).toHaveText('Failure');
    await expect(page.locator('.terminal button')).toHaveText('Failure');
    await expect(page.locator('pre')).toHaveText('Failure');
    await expect(page.locator('#run-link')).toHaveText('摘要');
    await page.locator('#conclusion').evaluate(node => { node.textContent = 'Queued'; });
    await expect(page.locator('#conclusion')).toHaveText('排队中');

    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(popup.locator('#github-status')).toHaveText('已切换到专业档。');
    await expect(page.locator('#conclusion')).toHaveText('排队中');
    await page.locator('#conclusion').evaluate(node => { node.firstChild.data = 'Success'; });
    await expect(page.locator('#conclusion')).toHaveText('成功');
    await toggle.uncheck();
    await expect(page.locator('#conclusion')).toHaveText('Success');
    await expect(page.locator('#run-link')).toHaveText('Summary');
    await toggle.check();

    await page.locator('#job-link').click();
    await expect(page).toHaveURL(`https://github.com${job}`);
    await expect(page.locator('#run-link')).toHaveText('摘要');
    await page.locator('.PageHeader-parentLink a').click();
    await expect(page).toHaveURL(`https://github.com${workflow}`);
    await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('button', { name: '状态' })).toBeVisible();
});
