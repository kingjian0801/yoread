# GitHub 界面汉化来源

本扩展使用 [maboloshi/github-chinese](https://github.com/maboloshi/github-chinese) 的简体中文词库与规则，固定到上游提交 [cd572b37fd8995919cca9d1b83e7b47029bdef47](https://github.com/maboloshi/github-chinese/commit/cd572b37fd8995919cca9d1b83e7b47029bdef47)。

- Copyright (C) 2016–2021 楼教主 ([52cik](https://github.com/52cik))
- Copyright (C) 2021–当前 沙漠之子 ([maboloshi](https://github.com/maboloshi))

随扩展分发的 `locals.js` 与上游该提交逐字节相同。Yoread 于 2026-11-19 新增独立 Chrome 扩展适配层，使用上游的静态词条、正则、路由匹配和排除规则。适配层限制处理范围为仓库首页、Issue 和 PR 的固定界面，保留网页正文，并支持按开关撤销界面汉化。上游用户脚本及其在线翻译流程未纳入扩展。

Yoread 采用 GNU General Public License v3.0 或更新版本分发，许可证见项目根目录或扩展分发包中的 `LICENSE`。Yoread 先前以 MIT 发布的部分保留原始版权与许可声明，见 `LICENSE-MIT-ORIGINAL`。对应源码见 [Yoread 仓库](https://github.com/kingjian0801/yoread)，试用包附带构建它的同版本源码。

## 首批验收

GitHub 专用汉化默认关闭。用工具栏面板的「GitHub 界面汉化」开关启用。Chrome 首次提示时，只授权对 github.com 的访问。

| 页面 | 样本界面词条 |
| --- | --- |
| 仓库首页 | Code、Issues、Pull requests |
| Issue | Open、Closed、New issue |
| PR | Open、Merged、Files changed |

验收时同时检查仓库名、用户名、分支名、提交哈希和代码保持原样。开启汉化无需 DeepSeek API Key。
