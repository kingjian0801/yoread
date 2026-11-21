# GitHub 汉化巡检报告

巡检命令读取固定页面样本中的英文原文与实际渲染文字，按当前本地词库输出 JSON。样本可以由维护者保存，也可以由浏览器巡检程序生成。命令在本地比较文字，不访问 GitHub。

## 运行固定样例

```sh
node scripts/github-inspection.mjs < tests/fixtures/github-inspection.json
node --test tests/integration/github-inspection.test.mjs
```

第一条命令会报告未收录的 `Inspect snapshot` 和没有渲染译文的 `New issue`。同一仓库页面的两个 `Inspect snapshot` 位置记为一个受影响页面。第二条命令验证这两项修复后的样本和候选词库能够通过复跑。

默认检查入门档。检查专业档时传入 `--mode professional`。校对候选版本时可用本地可信词库文件覆盖内置词库，例如 `--dictionary /path/to/locals.js`。

## 记录页面样本

输入是 JSON 数组。每个样本记录 GitHub 页面 URL、词库页面键及实际渲染证据。

```json
[
    {
        "pageType": "repository",
        "url": "https://github.com/acme/demo",
        "controls": [
            { "location": "nav [data-tab-item='code']", "source": "Code", "rendered": "代码" }
        ]
    },
    {
        "pageType": "repository/issues",
        "url": "https://github.com/acme/demo/issues",
        "error": "403 Forbidden"
    }
]
```

- `pageType` 使用词库的页面键，例如 `repository`、`repository/issues`、`repository/pulls` 或 `repository/pull`。
- `location` 写可复查的选择器或控件位置。采集界面固定文案，对照汉化关闭时的 `source` 和开启后同一位置的 `rendered`。无法定位现有词条对应的渲染位置时，保留已知原文与定位线索，将 `rendered` 写为空字符串。
- 正文、品牌、自定义名称可直接省略，或仅用 `{"kind":"content"}`、`{"kind":"brand"}`、`{"kind":"identifier"}` 标记。记录访问失败时用 `error`，其中不应附带正文或凭据。

## 解读与复跑

| 字段 | 含义 |
| --- | --- |
| `dictionaryVersion` | 本次使用的词库和本地术语文件的内容哈希。 |
| `pages` | 页面级匹配、未收录、规则失效和保留英文的数量。 |
| `findings` | 待校对项。 `unlisted` 表示无适用词条，`rule-failed` 表示实际文字与本地词库的预期不同。 |
| `retained` | 词库明确保留英文且渲染结果一致的文案。 |
| `accessFailures` | 无法访问的样本及原因，单独记录。 |

待校对项按受影响页面数降序排列。报告按页面键和 URL 路径去重，筛选参数和锚点仍保存在复查用的样本链接中。每个问题每页保留一个复查位置。

修复词条或匹配规则后重新采集相同位置并复跑。退出码 `0` 表示通过，`1` 表示仍有待校对项或页面访问失败，`2` 表示输入或词库读取失败。
