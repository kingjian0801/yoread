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

Yoread 0.1.4 候选包已在独立的 macOS Microsoft Edge 158.0.4370.33 配置中通过公开仓库授权、汉化、专业档和关闭恢复检查。关闭时 GitHub 站点权限被移除。 [GitHub 示例仓库](https://github.com/octocat/Hello-World)

Firefox 的 XPI 构建、临时安装与重启验证见 [Firefox 候选包](firefox-preview.md)。
macOS 原生封装和安装步骤见 [Safari 候选包](safari-candidate.md)。

## 同一提交的四端候选包

在 macOS 上使用 Node.js 22+、完整 Xcode 及命令行 `git`、`zip`、`unzip` 和 `tar`。在仓库根目录选择一个新输出目录。命令从当前 Git 提交归档源码，使用归档内的构建脚本生成四端安装候选。

```sh
node scripts/package-release.mjs dist/candidate
(cd dist/candidate && shasum -a 256 -c SHA256SUMS)
```

已有正式版本标签时，检出该提交并指定 `--tag vX.Y.Z`，其中 `X.Y.Z` 是扩展清单版本。命令要求标签指向当前提交，并校验四端扩展清单、Safari 宿主和扩展的版本。暂存和未提交文件均在 Git 归档范围之外，已存在的候选目录需保留或另选新目录。

| 产物 | 用途 | 公开分发渠道 |
| --- | --- | --- |
| `yoread-X.Y.Z-chrome.zip` | Chrome 扩展 ZIP | Chrome Web Store |
| `yoread-X.Y.Z-edge.zip` | Edge 扩展 ZIP | Microsoft Edge Add-ons |
| `yoread-X.Y.Z-firefox.xpi` | Firefox 临时安装候选 | Mozilla Add-ons |
| `yoread-X.Y.Z-safari.zip` | Safari 本地签名的 `Yoread.app` | Mac App Store |
| `yoread-X.Y.Z-source.zip` | 同一提交的源码和许可 | GitHub Release |

Safari 默认使用临时签名进行包结构校验。已有对应团队的 Apple Development 签名身份时，可加 `--team TEAM_ID` 构建本机验收包。公开提交由对应商店完成分发签发，保存最终发布产物及其验收记录。

`candidate.json` 记录 Git 提交、标签、版本、四端产物与 SHA-256 摘要、产物用途、签名类型、分发渠道和源码许可清单。未签名的商店提交包与本机验收包分别记录。新生成的记录为未提交、待验收，实际公开安装链接随各商店的验收记录填写。保存原始候选记录及 `SHA256SUMS`，在验收记录中使用同一 Git 提交和包摘要关联最终公开版本。

GitHub Actions 的 [Candidate packages](../.github/workflows/candidate-packages.yml) 在同仓 PR 或 `main` 的 CI 结束后运行，先核对 `Repository checks` 通过。生产部署失败时，已通过门禁的 `main` 仍可取得候选包。PR 候选记录开发分支的源提交，PR 门禁验证 GitHub 生成的合并预览。用于发布验收的候选取自 `main`。

工作流在 GitHub 托管的 macOS Runner 构建并校验源提交。下载 `yoread-candidate-<提交 SHA>` 可取得四端产物、源码、候选记录和校验值。云端 Safari 候选使用临时签名，商店分发签名与安装验收在发布时完成。
