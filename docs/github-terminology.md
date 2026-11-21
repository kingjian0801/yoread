# GitHub 汉化术语维护

项目术语表在 [data/github-terminology.json](../data/github-terminology.json)。Chrome、Edge、Firefox 和 Safari 的构建从它生成本地术语脚本，巡检也读取同一份数据。

## 查询与校验

```sh
node scripts/github-terminology.mjs query --english 'Pull requests' --scope repository/pulls
node scripts/github-terminology.mjs query --english Fork
node scripts/github-terminology.mjs validate
```

查询按英文做不区分大小写的子串匹配。指定作用域时同时返回通用项和对应作用域的例外。不指定作用域可查看全部适用位置。默认读取项目词库，校对外部草稿时可用 --file 指定 JSON 文件。

## 录入约定

| 字段 | 用途 |
| --- | --- |
| english | GitHub 界面中的完整英文原文。运行时区分大小写。 |
| scope | common 表示通用词条。repository/pull 等页面标识表示例外。header-label 表示两档共享的顶栏无障碍标签。 |
| translations | 按语言记录 beginner、professional 两种译法。页面例外优先于通用词条。 |
| example | 写清控件位置或用户看到该文案的情景。 |
| keepEnglish | 某档沿用英文原文时，说明实际用途。 |
| review | 合并、确认合并和删除类词条保留 GitHub 文档链接与核对说明。 |

- 入门档与 GitHub 中文文档术语对齐，可附上熟悉的缩写。专业档允许使用 PR、Fork 等常用表达，同一词条保留英文时说明用途。 [GitHub 从复刻创建拉取请求](https://docs.github.com/zh/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) · [Pro Git 向项目贡献](https://git-scm.com/book/zh/v2/GitHub-%E5%AF%B9%E9%A1%B9%E7%9B%AE%E5%81%9A%E5%87%BA%E8%B4%A1%E7%8C%AE)
- 人工核对高风险词条时，确认两档都明确区分操作、目标和确认阶段。合并按钮和二次确认需要分开对照，删除分支的译文应明确操作对象。 [GitHub 合并拉取请求](https://docs.github.com/zh/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request) · [GitHub 删除和恢复拉取请求分支](https://docs.github.com/zh/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request)

校验覆盖重复的 JSON 键和同作用域词条、空译文、内联标签与占位符、冲突的页面规则、已声明语种缺译和高风险说明。错误会指出文件及具体行或词条字段。现有 PR 的 Unit tests 运行词库校验及好坏样本。四端构建也会在打包前读取并校验这份数据。当前发布语言为 zh-CN。

上游词库的来源及许可见 [上游声明](../extension/vendor/github/NOTICE.md)。这一校验针对项目维护的术语数据。上游的默认译法继续由浏览器回归和巡检覆盖。
