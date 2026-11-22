import { expect, test } from './browser-fixture.mjs';

const releaseList = '/cli/cli/releases';
const releaseDetail = releaseList + '/tag/v2.105.0';

test('localizes the Releases list without changing release titles or navigation', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    // Model the public cli/cli Releases list with labels that could also be user content.
    fixture.html = `
        <main>
            <nav data-component="Sidebar.Main" aria-label="Releases and tags">
                <a href="${releaseList}">Releases</a>
                <a href="/cli/cli/tags">Tags</a>
                <h2>On this page</h2>
                <a href="#release-v2.105.0">Latest</a>
            </nav>
            <header data-component="PageLayout.Header"><h1 data-component="PH_Title">Releases</h1></header>
            <section id="release-v2.105.0" data-release-anchor="release-v2.105.0">
                <h2 class="sr-only">Latest</h2>
                <div class="Box">
                    <h2><a class="Link" href="${releaseDetail}">Latest</a></h2>
                    <a class="Link" href="${releaseList}/latest"><span class="Label Label--success">Latest</span></a>
                    <span class="Label Label--warning">Pre-release</span>
                    <div class="markdown-body"><button>Compare</button></div>
                    <a class="btn" href="${releaseList}/tag/Compare">Compare</a>
                </div>
            </section>
            <div class="pagination" role="navigation" aria-label="Pagination">
                <a class="next_page" href="${releaseList}?page=2">Next</a>
            </div>
        </main>`;
    const popup = await open('github.com', releaseList);
    await popup.getByRole('switch', { name: 'GitHub 界面汉化' }).check();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('发行版');
    await expect(page.locator('nav h2')).toHaveText('本页目录');
    await expect(page.locator('nav a[href="/cli/cli/tags"]')).toHaveText('标签');
    await expect(page.locator('a[href="#release-v2.105.0"]')).toHaveText('Latest');
    await expect(page.locator('.sr-only')).toHaveText('Latest');
    await expect(page.locator('.Box h2 a')).toHaveText('Latest');
    await expect(page.locator('.Label--success')).toHaveText('最新发行版');
    await expect(page.locator('.Label--warning')).toHaveText('预发行版');
    await expect(page.locator('.markdown-body button')).toHaveText('Compare');
    await expect(page.locator('a[href$="/tag/Compare"]')).toHaveText('Compare');
    await expect(page.locator('.next_page')).toHaveText('下一页');
    await expect(page.locator('.next_page')).toHaveAttribute('href', releaseList + '?page=2');
    await Promise.all([
        page.waitForURL('https://github.com' + releaseDetail),
        page.locator('.Box h2 a').click(),
    ]);
});

test('localizes the assets loaded after expanding release details and preserves download targets', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const archive = '/cli/cli/archive/refs/tags/v2.105.0.zip';
    const download = releaseList + '/download/v2.105.0/Download';
    fixture.html = `
        <main>
            <nav aria-label="Repository"><button>Fork</button></nav>
            <nav aria-label="Breadcrumb">
                <ol><li class="breadcrumb-item"><a href="${releaseList}">Releases</a></li>
                <li class="breadcrumb-item"><a href="${releaseDetail}">v2.105.0</a></li></ol>
            </nav>
            <div class="Box-body">
                <h1>Assets</h1>
                <a class="btn" href="/cli/cli/commit/e121949">e121949</a>
                <div class="markdown-body"><h2>Latest</h2><p>Find a release</p></div>
            </div>
            <details-toggle><details>
                <summary data-target="details-toggle.summaryTarget"><span>Assets</span> <span class="Counter">2</span></summary>
                <div id="expanded-assets"></div>
            </details></details-toggle>
            <output></output>
        </main>
        <script>
            document.querySelector('details').addEventListener('toggle', event => {
                if (!event.target.open) return;
                document.querySelector('#expanded-assets').innerHTML = \`
                    <a class="wb-break-all btn" rel="nofollow" href="${download}"><span>Download</span></a>
                    <a class="wb-break-all" rel="nofollow" href="${archive}"><span class="text-bold">Source code</span> (zip)</a>
                \`;
            });
            document.querySelector('#expanded-assets').addEventListener('click', event => {
                event.preventDefault();
                document.querySelector('output').textContent = event.target.closest('a').getAttribute('href');
            });
        </script>`;
    const popup = await open('github.com', releaseDetail);
    const localization = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    await localization.check();
    await expect(page.locator('nav[aria-label="Breadcrumb"] a').first()).toHaveText('发行版');
    await expect(page.locator('nav[aria-label="Breadcrumb"] a').last()).toHaveText('v2.105.0');
    await expect(page.locator('h1')).toHaveText('Assets');
    await expect(page.locator('.markdown-body h2')).toHaveText('Latest');
    await expect(page.locator('.markdown-body p')).toHaveText('Find a release');
    await expect(page.locator('a[href*="/commit/"]')).toHaveText('e121949');

    const summary = page.locator('summary');
    await expect(summary).toHaveText('资源 2');
    await summary.click();
    await expect(page.locator('details')).toHaveAttribute('open', '');
    const source = page.locator('a[href*="/archive/"]');
    await expect(source).toHaveText('源代码 (zip)');
    const asset = page.locator('a[href*="/download/"]');
    await expect(asset).toHaveText('Download');
    await asset.click();
    await expect(page.locator('output')).toHaveText(download);
    await source.click();
    await expect(page.locator('output')).toHaveText(archive);

    const fork = page.locator('nav[aria-label="Repository"] button');
    await expect(fork).toHaveText('复刻（Fork）');
    await popup.getByRole('combobox', { name: '汉化模式' }).selectOption('professional');
    await expect(fork).toHaveText('Fork');
    await expect(source).toHaveText('源代码 (zip)');
    await localization.uncheck();
    await expect(summary).toHaveText('Assets 2');
    await expect(source).toHaveText('Source code (zip)');
    await expect(page.locator('details')).toHaveAttribute('open', '');
});

test('localizes release search and comparison controls without changing input or comparison tags', async ({ browserApp }) => {
    const { fixture, open, page } = browserApp;
    const comparison = '/cli/cli/compare/v2.104.0...v2.105.0';
    fixture.html = `
        <main>
            <form action="${releaseList}"><input id="release-filter" type="search" name="q"
                placeholder="Find a release" aria-label="Find a release"></form>
            <select-panel>
                <button onclick="document.querySelector('dialog').showModal()">Compare</button>
                <dialog data-target="select-panel.dialog" aria-labelledby="compare-title">
                    <h1 class="Overlay-title" id="compare-title">Choose a tag to compare</h1>
                    <label for="tag-filter">Filter</label><input id="tag-filter" name="filter" type="search">
                    <ul role="listbox" aria-label="Choose a tag to compare">
                        <li><a role="option" href="${comparison}">Compare</a></li>
                    </ul>
                    <div data-target="select-panel.noResults" hidden><h2>No results found</h2></div>
                    <a href="/cli/cli/tags">View all tags</a>
                </dialog>
            </select-panel>
        </main>`;
    const popup = await open('github.com', releaseList);
    const localization = popup.getByRole('switch', { name: 'GitHub 界面汉化' });
    const filter = page.getByRole('searchbox', { name: 'Find a release' });
    await filter.fill('Latest');
    await localization.check();
    const localized = page.getByRole('searchbox', { name: '搜索发行版' });
    await expect(localized).toHaveAttribute('placeholder', '搜索发行版');
    await expect(localized).toHaveValue('Latest');
    await page.getByRole('button', { name: '对比' }).click();
    const dialog = page.getByRole('dialog', { name: '选择标签进行比较' });
    await expect(dialog.getByRole('link')).toHaveText('查看全部标签');
    const tag = dialog.getByRole('option', { name: 'Compare' });
    await expect(tag).toHaveAttribute('href', comparison);
    await expect(dialog.getByRole('listbox', { name: '选择标签进行比较' })).toBeVisible();
    const tagFilter = dialog.getByRole('searchbox', { name: '筛选' });
    await expect(tagFilter).toBeVisible();
    await tagFilter.fill('Compare');
    await dialog.locator('[data-target="select-panel.noResults"]').evaluate(element => { element.hidden = false; });
    await expect(dialog.locator('h2')).toHaveText('未找到结果');
    await localization.uncheck();
    await expect(page.locator('#release-filter')).toHaveAttribute('placeholder', 'Find a release');
    await expect(page.locator('#release-filter')).toHaveAttribute('aria-label', 'Find a release');
    await expect(page.locator('#release-filter')).toHaveValue('Latest');
    await expect(page.getByRole('dialog', { name: 'Choose a tag to compare' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Filter' })).toHaveValue('Compare');
});
