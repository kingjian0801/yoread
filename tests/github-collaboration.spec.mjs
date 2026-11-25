import { expect, test } from './browser-fixture.mjs';

test('localizes GitHub issue list and detail controls while preserving collaborator content', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = request => {
        if (new URL(request.url, 'https://github.com').pathname.endsWith('/issues/12')) {
            return `<react-app app-name="repo"><main>
                <bdi data-testid="issue-title">Open</bdi>
                <span data-testid="header-state" data-component="StateLabel">Open</span>
                <div class="markdown-body">Closed</div>
                <textarea aria-label="Edit">Draft</textarea>
                <button>Close issue</button>
                <button onclick="deleteIssue.showModal()">Delete issue</button>
                <dialog id="deleteIssue" aria-labelledby="deleteHeading">
                    <h2 id="deleteHeading">Delete issue?</h2>
                    <form method="dialog"><button type="button">Delete this issue</button><button>Cancel</button></form>
                </dialog>
            </main></react-app>`;
        }
        return `<react-app app-name="repo"><main>
            <h1 data-testid="header-title">Issues</h1>
            <div id="issues-index-filter" role="form" aria-label="Search issues">
                <input value="is:issue is:open">
                <ul id="issues-index-filter-results" role="listbox" aria-label="Suggestions"></ul>
            </div>
            <button data-component="Button" aria-label="Filter by author" aria-haspopup="dialog"
                    aria-expanded="false" onclick="filters.showModal(); this.setAttribute('aria-expanded', true)">Author</button>
            <dialog id="filters" aria-label="Filter by author">
                <button aria-label="Close dialog" onclick="filters.close()">Close</button>
            </dialog>
            <a data-component="Button" href="/login?return_to=https://github.com/acme/demo/issues">New issue</a>
            <a class="btn" data-testid="issue-listitem-title-link" href="/acme/demo/issues/12">Open</a>
            <button aria-label="Filter by label Open"><span data-component="IssueLabel">Open</span></button>
            <svg class="octicon octicon-issue-opened" role="img" aria-label="Open"></svg>
        </main></react-app>`;
    };

    const popup = await open('github.com', '/acme/demo/issues');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();

    await expect(page.getByTestId('header-title')).toHaveText('议题');
    await expect(page.getByRole('form')).toHaveAccessibleName('搜索议题');
    await expect(page.getByRole('listbox')).toHaveAccessibleName('建议');
    await expect(page.locator('input')).toHaveValue('is:issue is:open');
    const filter = page.getByRole('button', { name: '按用户筛选' });
    await filter.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '按用户筛选' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '创建议题' })).toHaveAttribute('href', /\/login\?return_to=/);
    await expect(page.getByTestId('issue-listitem-title-link')).toHaveText('Open');
    await expect(page.getByRole('button', { name: 'Filter by label Open' })).toHaveText('Open');
    await expect(page.locator('svg.octicon')).toHaveAccessibleName('打开');

    await page.getByTestId('issue-listitem-title-link').click();
    await expect(page).toHaveURL(/\/issues\/12$/);
    await expect(page.getByTestId('header-state')).toHaveText('打开');
    await expect(page.getByTestId('issue-title')).toHaveText('Open');
    await expect(page.locator('.markdown-body')).toHaveText('Closed');
    await expect(page.locator('textarea')).toHaveValue('Draft');
    await page.getByRole('button', { name: '删除议题', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '删除议题？' });
    await expect(confirmation.getByRole('button', { name: '确认删除此议题' })).toBeVisible();
    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(confirmation.getByRole('button', { name: '确认删除此议题' })).toBeVisible();
    await confirmation.getByRole('button', { name: '取消' }).click();
    await toggle.uncheck();
    await expect(page.getByTestId('header-state')).toHaveText('Open');
    await expect(page.locator('textarea')).toHaveAttribute('aria-label', 'Edit');
});

test('localizes creating and reviewing a pull request with stable confirmation terms', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = request => {
        const path = new URL(request.url, 'https://github.com').pathname;
        if (path.endsWith('/compare')) {
            return `<main><div class="compare-pr">
                <h2 class="subhead-heading">Open a pull request</h2>
                <button>base: <span class="branch-name">Open</span></button>
                <input id="pull_request_title" value="Conversation">
                <textarea id="pull_request_body">Review changes</textarea>
                <form action="/acme/demo/pull/5"><button>Create pull request</button></form>
            </div></main>`;
        }
        if (path.includes('/pull/5')) {
            return `<main>
                <nav aria-label="Pull request navigation">
                    <a data-dd-action-name="pull_requests.navigation.conversation" href="/acme/demo/pull/5">Conversation</a>
                    <a data-dd-action-name="pull_requests.navigation.files" href="/acme/demo/pull/5/files">Files changed</a>
                </nav>
                <span class="StateLabel" data-component="StateLabel"><svg class="octicon octicon-git-pull-request"
                    aria-label="Pull request" role="img"></svg>Open</span>
                <h1 class="gh-header-title">Conversation</h1>
                <a class="branch-name" href="/acme/demo/tree/Open">Open</a>
                <div class="commit-title"><button>Review changes</button></div>
                <div class="comment-body"><button>Close</button></div>
                <div class="diff-text-inner"><button>Open</button></div>
                <review-thread-collapsible>
                    <button id="thread" aria-labelledby="thread-label"></button>
                    <tool-tip id="thread-label" for="thread" data-type="label" aria-hidden="true">Comment thread</tool-tip>
                </review-thread-collapsible>
                <div class="js-merge-box">
                    <button onclick="merge.showModal()">Merge pull request</button>
                    <dialog id="merge"><form method="dialog"><button>Confirm merge</button></form></dialog>
                    <button>Delete branch</button>
                </div>
                <details><summary>Review changes</summary>
                    <button onclick="this.textContent='Unresolve conversation'">Resolve conversation</button>
                    <button>Submit review</button>
                </details>
            </main>`;
        }
        return `<react-app app-name="repo"><main>
            <nav aria-label="Repository"><a href="/acme/demo/pulls">Pull requests</a></nav>
            <h1 data-testid="header-title">Pull requests</h1>
            <div role="search" aria-label="Pull requests">
                <div id="repo-pulls-dashboard-filter" role="form" aria-label="Search pull requests"></div>
            </div>
            <div id="items-list-view-metadata"><a data-component="Text" href="?q=is%3Aclosed">Closed</a></div>
            <a data-component="Button" href="/acme/demo/compare"><span data-component="text">New pull request</span></a>
            <a class="btn" data-testid="listitem-title-link" href="/acme/demo/pull/5">Open</a>
        </main></react-app>`;
    };
    const popup = await open('github.com', '/acme/demo/pulls');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    const mode = popup.getByRole('combobox', { name: '汉化模式' });
    await toggle.check();
    const nav = page.getByRole('navigation', { name: 'Repository' });
    await expect(nav.getByRole('link')).toHaveText('拉取请求（PR）');
    await expect(page.getByRole('search')).toHaveAccessibleName('拉取请求（PR）');
    await expect(page.getByRole('link', { name: '已关闭' })).toHaveAttribute('href', '?q=is%3Aclosed');
    await expect(page.getByTestId('listitem-title-link')).toHaveText('Open');
    await mode.selectOption('professional');
    await expect(nav.getByRole('link')).toHaveText('PR');
    await expect(page.getByTestId('header-title')).toHaveText('PR 列表');
    await expect(page.getByRole('search')).toHaveAccessibleName('PR 列表');

    await page.getByRole('link', { name: '新建 PR' }).click();
    await expect(page.getByRole('heading')).toHaveText('新建一个拉取请求');
    await expect(page.locator('#pull_request_title')).toHaveValue('Conversation');
    await page.locator('#pull_request_body').fill('Edited draft');
    await expect(page.locator('#pull_request_body')).toHaveValue('Edited draft');
    await expect(page.locator('.branch-name')).toHaveText('Open');
    await page.getByRole('button', { name: '创建拉取请求' }).click();
    await expect(page).toHaveURL(/\/pull\/5\??$/);
    await expect(page.getByRole('navigation')).toHaveAccessibleName('拉取请求导航');
    await expect(page.getByRole('img')).toHaveAccessibleName('PR');
    await page.getByRole('link', { name: '更改的文件' }).click();
    await expect(page).toHaveURL(/\/pull\/5\/files$/);
    await expect(page.locator('.diff-text-inner')).toHaveText('Open');
    await expect(page.locator('.gh-header-title')).toHaveText('Conversation');
    await expect(page.locator('.commit-title')).toHaveText('Review changes');
    await expect(page.locator('.comment-body')).toHaveText('Close');
    await expect(page.getByRole('button', { name: '评论讨论串' })).toHaveAttribute('aria-labelledby', 'thread-label');
    const review = page.locator('summary');
    await expect(review).toHaveText('审查更改');
    await review.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '转为已解决对话' }).click();
    await expect(page.getByRole('button', { name: '转为未解决对话' })).toBeVisible();
    await expect(page.getByRole('button', { name: '发表审查意见' })).toBeVisible();

    for (const selection of ['professional', 'beginner']) {
        await mode.selectOption(selection);
        const merge = page.getByRole('button', { name: '合并拉取请求' });
        await merge.click();
        await expect(page.getByRole('button', { name: '确认合并' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: '删除分支' })).toBeVisible();
    }
    await toggle.uncheck();
    await expect(review).toHaveText('Review changes');
    await expect(page.getByRole('button', { name: 'Unresolve conversation' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveAccessibleName('Pull request navigation');
});

test('localizes the GitHub conversation tab bar with its current telemetry attributes', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `<main>
        <nav aria-label="Pull request navigation" data-turbo="false">
            <a data-telemetry-action="pull_requests.navigation.conversation" href="/acme/demo/pull/39">Conversation</a>
            <a data-telemetry-action="pull_requests.navigation.files" href="/acme/demo/pull/39/files">
                <svg aria-hidden="true"></svg>Files changed
            </a>
        </nav>
        <article class="comment-body">Files changed</article>
    </main>`;
    const popup = await open('github.com', '/acme/demo/pull/39');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    const nav = page.getByRole('navigation', { name: '拉取请求导航' });
    await expect(nav.getByRole('link', { name: '讨论' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '更改的文件' })).toHaveAttribute('href', '/acme/demo/pull/39/files');
    await expect(page.locator('article')).toHaveText('Files changed');
    await toggle.uncheck();
    await expect(page.getByRole('link', { name: 'Files changed' })).toBeVisible();
});

test('localizes classic compare form and keeps branch names and accessible refs intact', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    fixture.html = `<main>
        <div class="Subhead">
            <h1 class="Subhead-heading Subhead-heading--large">Compare changes</h1>
            <div class="Subhead-description">Compare changes across branches, commits, tags, and more below. If you need to, you can also</div>
        </div>
        <details id="base-ref-selector" class="commitish-suggester" open>
            <summary><span class="fgColor-muted">base:</span><span data-menu-button>Open</span></summary>
            <div class="SelectMenu">
                <span class="SelectMenu-title">Choose a base ref</span>
                <input id="context-commitish-filter-field-base" aria-label="Find a branch" value="Open">
                <div id="ref-list-branches-base"><button role="menuitem">Closed</button></div>
            </div>
        </details>
    </main>`;
    const popup = await open('github.com', '/acme/demo/compare');
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await toggle.check();
    await expect(page.getByRole('heading')).toHaveText('比较变更');
    await expect(page.locator('.Subhead-description')).toContainText('比较跨分支');
    await expect(page.locator('.SelectMenu-title')).toHaveText('选择基础引用');
    await expect(page.locator('summary [data-menu-button]')).toHaveText('Open');
    await expect(page.getByRole('menuitem')).toHaveText('Closed');
    await expect(page.getByRole('textbox')).toHaveAccessibleName('搜索分支');
    await expect(page.getByRole('textbox')).toHaveValue('Open');
    await page.getByRole('textbox').evaluate(element => element.setAttribute('aria-label', 'Find a tag'));
    await expect(page.getByRole('textbox')).toHaveAccessibleName('查找标签');
    await toggle.uncheck();
    await expect(page.getByRole('textbox')).toHaveAccessibleName('Find a tag');
});
