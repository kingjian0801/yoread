# Yoread 隐私说明

## GitHub 界面汉化

开启汉化时，浏览器会请求访问 `github.com`。Yoread 使用安装包内的词库在本机替换界面文案。为恢复原文而保留的文案在当前页面内存中，页面关闭后释放。界面汉化不会将网页内容发送到翻译服务。关闭汉化后会恢复原文，并移除 Yoread 请求的 GitHub 站点访问权限。

## Chrome 网页正文翻译

Chrome 版支持使用你自己的 DeepSeek API Key。Yoread 把 Key 和扩展设置保存在浏览器的本地扩展存储中。测试连接时，扩展使用 Key 向 DeepSeek 发送固定短句 `Hello, world.`。

你主动点击翻译且确认发送后，扩展才会把待译的正文文本片段通过 HTTPS 直接发送到 `api.deepseek.com`。Key 用于认证请求。扩展不会在请求正文中附带网页地址，也不会转发网站的 Cookie 或请求头。DeepSeek 对收到的数据的处理见其开放平台隐私政策。 [DeepSeek 开放平台隐私政策](https://cdn.deepseek.com/policies/zh-CN/deepseek-open-platform-privacy-policy.html)

Yoread 没有接入统计或广告服务。你可以在弹窗设置中清除已保存的 Key。恢复原文会撤销本页的译文展示，已经发送到翻译服务的请求由该服务处理。

## 反馈

如需报告问题，请提供浏览器、Yoread 版本和可复现步骤。公开反馈中请勿粘贴 API Key、私有页面正文或含敏感内容的截图。 [Yoread 问题反馈](https://github.com/kingjian0801/yoread/issues/new)
