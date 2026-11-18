# yoread

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
- 按实际改动运行项目适用的测试、静态检查及构建，并说明验证结果与未覆盖项。当前仓库尚无业务代码；已有仓库检查命令见下方 CI 说明。
- 提交、推送、PR、合并和部署按具体任务授权执行。

## 工作流文件

| 路径 | 用途 |
| --- | --- |
| `AGENTS.md` | 项目工作流入口规则 |
| `.agents/skills/` | 28 个项目技能及其参考文件 |
| `docs/agents/` | 本地任务、术语及状态约定 |
| `docs/agents/matt-workflow/` | 来源版本、版权声明和上游许可证 |

Matt 上游技能固定于提交 `5863806dd4e15c63174bee4e7515a4256792ecfa`，来源记录见 [version.json](docs/agents/matt-workflow/version.json)。版权说明见 [NOTICE.md](docs/agents/matt-workflow/NOTICE.md)，上游许可证见 [mattpocock-MIT.txt](docs/agents/matt-workflow/mattpocock-MIT.txt)。后续工作流更新应连同规则、技能、参考文件及版本记录一起提交，以便成员通过 `git pull` 获取同一版本。

## CI

[GitHub Actions CI](https://github.com/kingjian0801/yoread/actions/workflows/ci.yml) 在推送到 `main`、创建或更新 PR，以及手动触发时运行 `Repository checks`。

检查技能目录与版本清单是否一致、技能入口元数据、必要的项目规则及许可证文件、README 本地链接，以及两个 Shell 模板的语法。检查使用 Python 3.13 标准库和 Bash，无需安装第三方 Python 包；Shell 模板只做语法检查。

在项目根目录执行相同检查：

```sh
python3 scripts/check_workflow.py
bash -n .agents/skills/wizard/template.sh
bash -n .agents/skills/diagnosing-bugs/scripts/hitl-loop.template.sh
```

当前仅配置 CI。后续引入业务代码时，应补充对应的测试和构建步骤；CD 暂不建立。
