import { expect, test } from './browser-fixture.mjs';

test('localizes milestone controls and progress without changing milestone data or links', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const list = '/acme/demo/milestones';
    const detail = '/acme/demo/milestone/34';
    const issueFilter = '/acme/demo/issues?q=is%3Aopen%20milestone%3AOpen';
    fixture.html = request => {
        const url = new URL(request.url, 'https://github.com');
        if (url.pathname === detail) {
            return `<main>
                <div class="milestoneDetailsWrapper__fixture">
                    <h1 data-component="PH_Title">Open</h1>
                    <div data-testid="milestone-status"><span data-component="StateLabel" data-status="open">Open</span></div>
                    <div id="milestone-description"><button>Open</button></div>
                    <div class="progressSection__fixture"><span><strong>75%</strong> complete</span></div>
                    <button id="subscription" onclick="this.textContent='Unsubscribe'">Subscribe</button>
                </div>
                <div role="region" aria-label="Milestone issues">
                    <ul class="stateFilters__fixture" aria-label="Filter issues by state">
                        <li><a data-component="Text" href="#open"><div>Open</div><span>1</span></a></li>
                    </ul>
                    <a data-testid="issue-listitem-title-link" class="btn" href="/acme/demo/issues/12">Open</a>
                </div>
            </main>`;
        }
        if (url.pathname !== list) return '<main><button>Open</button></main>';
        return `<main>
            <h1 data-component="PH_Title">Milestones</h1>
            <div role="group" aria-label="Milestones" class="milestoneListWrapper__fixture">
                <h2 id="milestones-list-view-container-title">List view</h2>
                <a data-testid="open-milestone-tab" href="${list}"><div>Open</div><span>2</span></a>
                <a data-testid="closed-milestone-tab" href="${list}?state=closed"><div>Closed</div><span>28</span></a>
                <button id="sort" data-component="ActionMenu.Button" aria-haspopup="menu">Sort</button>
                <div id="sortmenu" role="menu"></div>
                <li class="milestoneRow__fixture">
                    <h3><a class="btn" href="${detail}">Open</a></h3>
                    <div class="milestoneDescription__fixture"><button>Open</button></div>
                    <div class="milestoneData__fixture"><span>No due date</span></div>
                    <div class="milestoneIssueCount__fixture"><span>3/4 issues closed</span></div>
                    <div class="listProgressSection__fixture">
                        <span id="complete"><strong>75%</strong> complete</span>
                        <a data-component="Link" href="${issueFilter}"><span>1</span> open</a>
                        <span data-component="ProgressBar.Item" role="progressbar"
                              aria-valuemin="0" aria-valuemax="100" aria-valuenow="75"></span>
                    </div>
                </li>
                <div id="reused"><button>Open</button></div>
            </div>
            <script>
                document.querySelector('#sort').addEventListener('click', () => {
                    const item = document.createElement('button');
                    item.setAttribute('role', 'menuitemradio');
                    item.textContent = 'Most complete';
                    item.addEventListener('click', () => { location.search = 'sort=completeness'; });
                    document.querySelector('#sortmenu').append(item);
                });
            </script>
        </main>`;
    };

    const popup = await open('github.com', list);
    const toggle = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    const mode = popup.getByRole('combobox', { name: '汉化模式' });
    await toggle.check();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('里程碑');
    const openTab = page.getByTestId('open-milestone-tab');
    await expect(openTab).toHaveText('进行中2');
    await expect(page.getByTestId('closed-milestone-tab')).toHaveText('已关闭28');
    await expect(page.getByRole('group')).toHaveAccessibleName('里程碑');
    await expect(page.locator('.milestoneData__fixture')).toHaveText('没有截止日期');
    await expect(page.locator('.milestoneIssueCount__fixture')).toHaveText('3/4 议题关闭');
    await expect(page.locator('#complete')).toHaveText('75% 已完成');
    await page.locator('#complete').evaluate(element => { element.lastChild.data = ' complete'; });
    await expect(page.locator('#complete')).toHaveText('75% 已完成');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    await expect(page.locator(`a[href="${issueFilter}"]`)).toHaveText('1 打开');
    await expect(page.locator('.milestoneDescription__fixture button')).toHaveText('Open');
    await expect(page.getByRole('heading', { level: 3 }).getByRole('link')).toHaveText('Open');
    const reused = page.locator('#reused');
    await expect(reused.getByRole('button')).toHaveText('打开');
    await reused.evaluate(element => { element.className = 'milestoneDescription__fixture'; });
    await expect(reused.getByRole('button')).toHaveText('Open');
    await reused.evaluate(element => { element.className = ''; });
    await expect(reused.getByRole('button')).toHaveText('打开');
    await mode.selectOption('professional');
    await expect(openTab).toHaveText('进行中2');

    await page.getByRole('button', { name: '排序' }).click();
    await page.getByRole('menuitemradio', { name: '最完整' }).click();
    await expect(page).toHaveURL(/sort=completeness$/);
    await page.getByTestId('closed-milestone-tab').click();
    await expect(page).toHaveURL(/state=closed$/);
    await page.getByRole('heading', { level: 3 }).getByRole('link').click();
    await expect(page).toHaveURL(/\/milestone\/34$/);
    await expect(page.getByTestId('milestone-status')).toHaveText('进行中');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open');
    await expect(page.locator('#milestone-description button')).toHaveText('Open');
    const stateFilter = page.getByRole('list', { name: '按状态筛选议题' });
    await expect(stateFilter.getByRole('link')).toHaveText('打开1');
    await expect(page.getByTestId('issue-listitem-title-link')).toHaveText('Open');
    await page.getByRole('button', { name: '订阅' }).click();
    await expect(page.getByRole('button', { name: '取消订阅' })).toBeVisible();

    await toggle.uncheck();
    await expect(page.getByTestId('milestone-status')).toHaveText('Open');
    await expect(page.getByRole('region')).toHaveAccessibleName('Milestone issues');
    await expect(page.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
});
