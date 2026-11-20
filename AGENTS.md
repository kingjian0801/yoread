<!-- matt-workflow:begin -->
## Matt 工程工作流
处理工程任务时先读取本项目规则，再读取 .agents/skills/engineering-workflow/SKILL.md，自动选择最少需要的技能。简单任务直接实施并验证，复杂任务按需澄清、记录和审查。项目的测试命令及发布权限仍按原有规则执行。本地任务记录见 docs/agents/issue-tracker.md。
<!-- matt-workflow:end -->

## 测试驱动开发

新增或修复可观察行为时，按 [Matt TDD 技能](.agents/skills/tdd/SKILL.md) 先通过已有公开接口写回归测试，确认它因预期行为缺失而失败，再做最小改动并重跑。把用例纳入现有测试套件，在 PR 里记录失败和通过的证据。纯文案和视觉微调按实际影响运行文档或浏览器检查。操作示例见 [测试驱动开发](README.md#测试驱动开发)。
