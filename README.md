# yoread

Yoread 是桌面 Chrome 网页翻译扩展。使用自己的 DeepSeek API Key 将当前网页的英文正文译为简体中文，并可恢复原文。GitHub 界面汉化使用本地词库，可独立启停。

## 安装和试用

1. 下载 PR CI 中的 `yoread-chrome-trial` 并解压，找到 `extension` 目录。也可在仓库根目录用 Node.js 22+ 执行 `npm run build` 得到 `dist/extension`。
2. 在桌面 Chrome 打开 `chrome://extensions`，开启「开发者模式」，选择「加载已解压的扩展程序」，并选中含 `manifest.json` 的目录。
3. 打开一个普通英文网页，点击工具栏的 Yoread，展开「DeepSeek 设置」并保存自己的 API Key，然后点击「测试连接」。连接测试使用固定短文本。试用模型为 DeepSeek 官方 API 的 `deepseek-flash`。
4. 点击「翻译此页」。每个页面首次发送正文前都会说明发送范围并等待确认。弹窗会显示正文进度，仍未完成时可点击「重试翻译」。滚动后新加载的正文用「翻译新增内容」补译，刷新或导航后重新确认。点击「恢复原文」可撤销正文翻译。
5. 如需 GitHub 菜单、按钮和状态标签使用中文，打开「GitHub 界面汉化」并允许该站点的访问权限。此开关默认关闭，开启后在本地应用词库。恢复 GitHub 正文原文时，界面汉化仍保留。

首版验收采用 [正式 PRD](.scratch/specs/yoread-mvp-prd.md) 的测试场景。Kim 和 Coco 分别用自己的 Key 在新闻、技术文档、博客、允许发送的非敏感登录页面及 GitHub 上试用。记录候选提交、扩展版本、样本、通过情况和问题。

## 开发验证

运行浏览器测试需要 Node.js 22+ 和命令行 `openssl`。首次在 Linux 安装 Chromium 时，可加 `--with-deps` 安装系统依赖。

```sh
npm ci
npm run test:unit
npm run test:integration
npm run build
npx playwright install --no-shell chromium
npm test
```

浏览器用例加载实际扩展，使用测试网页和模拟 DeepSeek 响应。安装包中的扩展代码及对应源码按 GPL-3.0 发布，保留项目原有的 [MIT 声明](LICENSE-MIT-ORIGINAL)。GitHub 词库的来源和适配范围见 [上游声明](extension/vendor/github/NOTICE.md)。

## Matt 工作流

本仓库已内置项目级 Matt 工程工作流，供成员使用 Codex 协作开发。

## 开始使用

1. 克隆仓库：

   ```sh
   git clone https://github.com/kingjian0801/yoread.git
   cd yoread
   ```

2. 在 Codex 中打开 `yoread` 项目目录，并启动新会话。
3. 直接描述需求，例如：“按本项目 Matt 工作流，修复……并验证。”项目入口规则见 [AGENTS.md](AGENTS.md)，技能选择入口见 [engineering-workflow](.agents/skills/engineering-workflow/SKILL.md)。

仓库包含全部 28 个技能及其参考文件，无需再下载安装包或运行安装脚本，也无需安装全局 Matt 技能。成员仍需自行准备 Codex 客户端及账号；本仓库提供的是 Codex 项目配置。

## 协作约定

- 明确的小改动直接实施并做必要验证；较大任务按需要澄清、记录规格、拆分任务及审查。
- 复杂任务的规格和本地任务格式见 [任务记录约定](docs/agents/issue-tracker.md)。默认不自动创建 GitHub 工单。
- 业务术语及长期设计决策见 [术语与决策约定](docs/agents/domain.md)，本地问题分流见 [状态约定](docs/agents/triage-labels.md)。
- 按实际改动运行项目适用的测试、静态检查及构建，并说明验证结果与未覆盖项。
- 提交、推送、PR、合并和部署按具体任务授权执行。

## 工作流文件

| 路径 | 用途 |
| --- | --- |
| `AGENTS.md` | 项目工作流入口规则 |
| `.agents/skills/` | 28 个项目技能及其参考文件 |
| `docs/agents/` | 本地任务、术语及状态约定 |
| `docs/agents/matt-workflow/` | 来源版本、版权声明和上游许可证 |

Matt 上游技能固定于提交 `5863806dd4e15c63174bee4e7515a4256792ecfa`，来源记录见 [version.json](docs/agents/matt-workflow/version.json)。版权说明见 [NOTICE.md](docs/agents/matt-workflow/NOTICE.md)，上游许可证见 [mattpocock-MIT.txt](docs/agents/matt-workflow/mattpocock-MIT.txt)。后续工作流更新应连同规则、技能、参考文件及版本记录一起提交，以便成员通过 `git pull` 获取同一版本。

## 日常提交、PR 和发布

### 1. 在开发分支提交并推送

开始新任务时，从最新远端 `main` 创建开发分支。下面用 `fix/page-translation` 举例。

```sh
git status --short --branch
git fetch origin
git switch -c fix/page-translation origin/main
```

如果已经在本地 `main` 上改了文件，用 `git switch -c fix/page-translation` 从当前提交创建分支并保留改动。已经在本次任务的开发分支上时可以直接提交。

按改动范围运行[开发验证](#开发验证)。将示例文件和提交说明换成本次实际内容，再推送当前分支。

```sh
git add -- extension/page.js
git diff --cached
git diff --cached --check
git commit -m "fix: 修复网页漏译"
git push -u origin HEAD
```

### 2. 创建 PR 并等待自动合并

1. 用自己的 GitHub 账号创建 PR，目标分支选 `main`，来源选刚推送到 Yoread 同仓库的开发分支。草稿准备好后点 **Ready for review**。 [创建 PR](https://github.com/kingjian0801/yoread/compare)
2. 在 PR 的 **Checks** 查看 `Select PR checks` 和 `Repository checks`。Kim 和 Coco 的正式 PR 会在选中的检查全部通过后自动合并。若检查失败，在同一个分支修复、提交并推送，现有 PR 会自动更新并重跑。
3. 合并后，机器人会触发 `main` 的 CI。它针对合并提交再跑三组测试，全部通过后将 **Deploy to production** 交给服务器上的 `yoread-production` Runner。PR 运行中的部署任务显示 **Skipped** 属正常。 [CI 运行](https://github.com/kingjian0801/yoread/actions/workflows/ci.yml)

### 3. 核对服务器发布版本

在 GitHub 上，先从已合并的 PR 记下 **Merge commit** 的 SHA。到 Actions 找到同一 SHA 的 `main` 运行，确认 **Deploy to production** 成功，并在日志中找到 `Deployed Yoread`、对应 SHA 和 `from Actions run` 的运行编号。

有服务器权限时，在服务器终端执行以下只读命令。

```sh
cat /root/kim_workspace/yoread/current/deployment.json
readlink /root/kim_workspace/yoread/current
```

- `revision` 对应已发布的合并提交 SHA，`run_id` 对应发布日志里的运行编号。
- `current` 应指向 `releases/actions/<完整 SHA>`。如果两人的 PR 接连合并，`current` 可能已经指向更新的版本。用该发布提交的历史确认是否已包含你的合并提交。

## CI

[GitHub Actions CI](https://github.com/kingjian0801/yoread/actions/workflows/ci.yml) 根据 PR 待合并提交的实际文件差异选档。`Repository checks` 始终汇总选中的作业结果。

- **轻量档**适用于弹窗 CSS，以及设置展开入口内的文字和静态标记。例如挪动按钮、调整间距或修改设置入口。CI 构建扩展，并运行标记为 `@popup` 的 Chromium 冒烟和回归用例，覆盖窄窗口、设置展开、Key 操作、发送确认、翻译进度、恢复原文和 GitHub 汉化开关。
- **完整档**适用于其余改动，包括翻译、确认和权限逻辑、弹窗脚本、依赖、测试、构建及 CI/CD。CI 运行 UT、集成测试和完整 Chromium E2E。`main` 的发布运行始终走完整档并校验产物。

在本地构建后可运行 `npm test -- --grep @popup` 复现轻量档的浏览器检查。用于验证分档规则的单元测试需要 Git 和 Python 3。

Kim（`kingjian0801`）和 Coco（`coco413`）从本仓库开发分支提交到 `main` 的非草稿 PR，在当前提交通过 CI 后由 [自动合并工作流](.github/workflows/auto-merge.yml) 合并。GitHub 的 `main` 分支保护仍要求通过 PR 和必需检查。

浏览器测试任务也检查 Matt 工作流、README 本地链接和 Shell 模板语法。成功后，试用包可在 Actions 运行页下载。

在项目根目录执行相同检查：

```sh
python3 scripts/check_workflow.py
bash -n .agents/skills/wizard/template.sh
bash -n .agents/skills/diagnosing-bugs/scripts/hitl-loop.template.sh
```

## 服务器部署

Yoread 只通过 GitHub Actions 的 **Deploy to production** 任务部署到服务器。`main` 的 CI 通过后，服务器上的 `yoread-production` Runner 下载同一次运行的已测试产物并发布。确认方法见[核对服务器发布版本](#3-核对服务器发布版本)。

首次安装时，在 Yoread 的 Actions 设置生成 Linux x64 Runner 注册令牌，下载官方 Runner 压缩包并核对 SHA-256。在服务器上用 root 执行以下命令。服务器需要 systemd、curl、jq、sudo 和系统 Python 的 PyJWT。

```sh
bash scripts/server-cd/install-runner.sh /absolute/path/actions-runner-linux-x64.tar.gz
```

- 安装脚本从标准输入读取一行注册令牌。Runner 以专用系统账户运行，发布程序核验 GitHub 签发的任务身份、CI 门禁和产物 SHA-256 后，才会切换 `current`。
- 服务器上的 Runner 由 systemd 服务 `yoread-actions-runner.service` 管理。
- 扩展目录为 `/root/kim_workspace/yoread/current/extension`，同目录下有 `yoread-chrome-trial.zip`、对应源码和记录提交及 Actions 运行 ID 的 `deployment.json`。
- 在 [GitHub Actions CI](https://github.com/kingjian0801/yoread/actions/workflows/ci.yml) 查看部署日志，可重跑失败任务，或在 `main` 上启动一次新的 CI。
