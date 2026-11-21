# GitHub 汉化候选包

Edge、Firefox 和 macOS Safari 的候选包只提供 GitHub 界面汉化。它们共用 Chrome 的离线词库、汉化规则和设置逻辑。默认关闭，启用时向浏览器申请 `github.com` 访问权限。

在仓库根目录运行对应命令。产物写入 `dist/<浏览器>`，版本沿用 Chrome 的扩展清单。

```sh
node scripts/build-github-only.mjs edge
node scripts/build-github-only.mjs firefox
node scripts/build-github-only.mjs safari
```

第二个参数可以指定尚不存在的输出目录，例如 `node scripts/build-github-only.mjs edge /tmp/yoread-edge-preview`。

## Edge 本机验收

打开 `edge://extensions`，在开发者模式下选择「加载解压缩的扩展」，选择 `dist/edge`。
在扩展弹窗开启 GitHub 汉化并允许站点访问。在一个公开仓库核对 `Code` 显示为「代码」，README 和分支名保持原样。关闭开关后检查导航恢复英文。

Windows 与 macOS 的正式发布包验收使用 Edge Add-ons 的公开安装入口。
