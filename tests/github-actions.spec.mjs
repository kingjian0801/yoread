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

test('keeps a terminal region and its accessible labels in the original language', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `
        <main><react-app>
            <section class="terminal" aria-label="Failure">
                <div role="group" aria-label="Status"><button>Failure</button></div>
                <relative-time datetime="2026-11-19T17:29:58Z">November 19, 2026</relative-time>
            </section>
        </react-app></main>`;
    const popup = await open('github.com', run);
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    await expect(page.getByRole('region', { name: 'Failure' }).getByRole('group', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Failure' })).toBeVisible();
    expect(await page.locator('relative-time').getAttribute('lang')).toBeNull();
});

test('keeps workflow names while localizing status options after a filter panel is reused', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `
        <main>
            <button onclick="const title = document.querySelector('#filter-title span'); title.firstChild.data = 'Filter by Status'">
                Show status filter
            </button>
            <button onclick="document.querySelector('#filter-title span').textContent = 'Filter by Workflow'">
                Show workflow filter
            </button>
            <div role="dialog" aria-labelledby="filter-title" data-component="SelectPanel">
                <h1 id="filter-title" data-component="SelectPanel.Title"><span>Filter by Workflow</span></h1>
                <ul role="listbox"><li role="option">
                    <span data-component="ActionList.Item.Label">Failure</span>
                </li></ul>
            </div>
        </main>`;
    const popup = await open('github.com', actions);
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    await expect(page.getByRole('dialog', { name: '按工作流筛选' }).getByRole('option', { name: 'Failure' })).toBeVisible();
    await page.getByRole('button', { name: 'Show status filter' }).click();
    await expect(page.getByRole('dialog', { name: '按状态筛选' }).getByRole('option', { name: '失败' })).toBeVisible();
    await page.getByRole('button', { name: 'Show workflow filter' }).click();
    await expect(page.getByRole('dialog', { name: '按工作流筛选' }).getByRole('option', { name: 'Failure' })).toBeVisible();
    await toggle.uncheck();
    await expect(page.getByRole('dialog', { name: 'Filter by Workflow' }).getByRole('option', { name: 'Failure' })).toBeVisible();
});

test('opens a failed job log and confirms both rerun choices in the fixture', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const summary = `
        <main>
            <page-header>
                <button id="reruns" aria-expanded="false" type="button">Re-run jobs</button>
                <div id="rerun-menu" role="menu" hidden>
                    <button role="menuitem" data-scope="failed">Re-run failed jobs</button>
                    <button role="menuitem" data-scope="all">Re-run all jobs</button>
                </div>
            </page-header>
            <react-partial partial-name="actions-run-jobs-list">
                <div class="jobsHeader__fixture"><h4 class="jobsHeading__fixture">All jobs</h4></div>
                <a href="${job}" class="WorkflowJob-title">Failure</a>
            </react-partial>
            <dialog-helper></dialog-helper>
            <output></output>
        </main>
        <script>
            const toggle = document.querySelector('#reruns');
            const menu = document.querySelector('#rerun-menu');
            toggle.addEventListener('click', () => {
                menu.hidden = !menu.hidden;
                toggle.setAttribute('aria-expanded', String(!menu.hidden));
            });
            for (const option of menu.querySelectorAll('[role="menuitem"]')) {
                option.addEventListener('click', () => {
                    toggle.click();
                    const scope = option.dataset.scope;
                    const dialog = document.createElement('dialog');
                    dialog.className = 'Overlay';
                    dialog.setAttribute('aria-labelledby', 'rerun-title');
                    const heading = scope === 'failed' ? 'Re-run failed jobs' : 'Re-run all jobs';
                    dialog.innerHTML = '<h1 id="rerun-title" class="Overlay-title">' + heading + '</h1>' +
                        '<div class="Overlay-body"><form method="post">' +
                        '<p>A new attempt of this workflow will be started, including <strong>' +
                        (scope === 'failed' ? 'all failed jobs' : 'all the jobs') +
                        '</strong></p>' +
                        '<label><input name="enable_debug_logging" type="checkbox">Enable debug logging</label>' +
                        '<button type="submit">Re-run jobs</button></form></div>';
                    dialog.querySelector('form').addEventListener('submit', event => {
                        event.preventDefault();
                        document.querySelector('output').textContent =
                            scope + ':' + new FormData(event.currentTarget).has('enable_debug_logging');
                        dialog.remove();
                    });
                    document.querySelector('dialog-helper').append(dialog);
                    dialog.showModal();
                });
            }
        </script>`;
    const logs = `
        <main>
            <h1><span class="WorkflowJob-title">Failure</span></h1>
            <div class="js-full-logs-container">
                <details>
                    <summary>Failure</summary>
                    <pre>Process completed with exit code 1</pre>
                </details>
            </div>
        </main>`;
    fixture.html = ({ url }) => url === job ? logs : summary;
    const popup = await open('github.com', run);
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();
    for (const { menuLabel, scopeDescription, useDebug, submission } of [
        { menuLabel: '重新运行失败作业', scopeDescription: '所有失败作业', useDebug: true, submission: 'failed:true' },
        { menuLabel: '重新运行所有作业', scopeDescription: '所有作业', useDebug: false, submission: 'all:false' },
    ]) {
        await page.getByRole('button', { name: '重新运行作业', exact: true }).click();
        await page.getByRole('menuitem', { name: menuLabel, exact: true }).click();
        const confirmation = page.getByRole('dialog', { name: menuLabel });
        await expect(confirmation).toBeVisible();
        await expect(confirmation.getByText(scopeDescription, { exact: true })).toBeVisible();
        const debug = confirmation.getByRole('checkbox', { name: '启用调试日志' });
        await expect(debug).not.toBeChecked();
        if (useDebug) await debug.check();
        await confirmation.getByRole('button', { name: '重新运行作业', exact: true }).click();
        await expect(page.locator('output')).toHaveText(submission);
    }
    await expect(page.getByRole('heading', { name: '所有作业' })).toBeVisible();
    const failedJob = page.getByRole('link', { name: 'Failure', exact: true });
    await expect(failedJob).toHaveAttribute('href', job);
    await failedJob.click();
    await expect(page).toHaveURL(`https://github.com${job}`);
    const log = page.getByText('Process completed with exit code 1', { exact: true });
    await expect(log).toBeHidden();
    await page.getByText('Failure', { exact: true }).and(page.locator('summary')).click();
    await expect(log).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Failure', exact: true })).toBeVisible();
});
