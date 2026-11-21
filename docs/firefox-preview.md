# Firefox 汉化候选包

## 构建与临时安装

在 Yoread 仓库根目录执行以下命令。候选扩展构建到 `dist/firefox`，可将目录内容打成待验收的 XPI。

```sh
node scripts/build-github-only.mjs firefox
(cd dist/firefox && zip -q -r -FS ../yoread-firefox-preview.xpi .)
```

在独立测试配置中打开 `about:debugging#/runtime/this-firefox`，点击 **Load Temporary Add-on**，选择 `dist/yoread-firefox-preview.xpi` 或 `dist/firefox/manifest.json`。Firefox 关闭后会卸载临时扩展。重启后使用同一个配置，再临时加载同一个候选包即可核对保存的状态。正式分发使用 Mozilla Add-ons 签名的版本。 [Firefox 临时扩展说明](https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/index.html#extensions)

## 仓库首页验证

1. 打开公开仓库首页，确认 **Code** 显示英文，扩展默认关闭。 [GitHub 示例仓库](https://github.com/octocat/Hello-World)
2. 打开 Yoread 弹窗并启用 GitHub 界面汉化。允许 Firefox 显示的 GitHub 网站权限请求。
3. 确认 **Code** 显示为「代码」，仓库名和分支名保留原样。刷新后仍显示中文。
4. 关闭 Firefox，再用同一个独立测试配置启动并重新临时安装该 XPI。确认弹窗开关仍开启，仓库首页仍显示中文。
5. 关闭汉化，确认 **Code** 恢复英文，之前授予的 GitHub 权限移除。

Yoread 0.1.4 候选包已在 macOS 上用 Firefox 160.0.1 完成以上步骤。实测使用 Mozilla Geckodriver 0.37.1 加载未签名的临时 XPI，实际授权由 Firefox 原生提示完成。重启前后使用同一独立配置，Firefox 进程不同。
