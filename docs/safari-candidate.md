# macOS Safari 候选包

Safari 候选包只提供 GitHub 界面离线汉化，使用与 Chrome 相同的渲染器和词库。网站访问权限限于 `https://github.com/*`，由用户启用时授权。

## 构建

使用 Node.js 22 或更新版本、完整的 Xcode 和 macOS。在仓库根目录执行以下命令。每次选择新的输出目录，或者先移走旧候选包。

```bash
node scripts/build-github-only.mjs safari dist/safari
node scripts/package-safari.mjs dist/safari dist/safari-app
codesign --verify --strict --deep dist/safari-app/Yoread.app
```

本机钥匙串已有对应团队的 Apple Development 签名身份时，可运行
`node scripts/package-safari.mjs dist/safari dist/safari-signed --team TEAM_ID` 生成 Safari 实机候选包。
将 `TEAM_ID` 换成自己的 10 位团队 ID，再用 `codesign --verify --strict --deep dist/safari-signed/Yoread.app` 验证。

输出为 `dist/safari-app/Yoread.app`，包含 Safari 可识别的 `Yoread Extension.appex`。应用 ID 为 `io.github.kingjian0801.Yoread`，应用、扩展与清单的版本来自同一构建。脚本使用 Xcode 的 Safari Web Extension Packager，最低应用部署目标设为 macOS 15.0，并构建 Apple Silicon 和 Intel 两种架构。

## 安装验收

1. 使用 Apple Development 签名构建应用及内嵌扩展，或按 Apple 开发测试流程在隔离环境中安装候选包。运行宿主应用后，打开 Safari 的「设置 → 扩展」，选中 Yoread。 [Apple 安装指引](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
2. 在 GitHub 公开仓库首页开启 GitHub 界面汉化。拒绝访问时保持英文，允许 GitHub 后「Code」显示为「代码」，面向用户的 README 和分支名称保持原样。
3. 刷新并重开 Safari，核对启用状态。关闭 Yoread 弹窗里的汉化开关，确认已有页面的导航恢复英文。访问其他域名，确认没有界面汉化。
4. 记录 macOS、Safari 和应用版本，以及授权、译文和恢复的结果。

脚本生成使用本地签名的测试候选包。Mac App Store 渠道使用 Apple Developer Program 的分发签名，并以对应发布产物再次验收。 [Apple 分发指引](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)

Yoread 0.1.4 的签名候选包已在 macOS 26.6.2 的隔离 WebKit 扩展宿主运行。测试覆盖拒绝及允许 GitHub 访问、仓库首页汉化、关闭后恢复英文并移除权限。

另在 macOS 26.6.2 / Safari 26.6.2 中安装并启用了 Apple Development 签名的 0.1.4 候选包。在未登录的公开仓库点击「启用汉化」后，Safari 弹出 GitHub 站点访问提示。选择「拒绝」时页面仍显示「Code」，扩展提示需要先允许访问 github.com。实际授予站点访问后的汉化、恢复及重启状态待验收。 [GitHub 示例仓库](https://github.com/octocat/Hello-World)
