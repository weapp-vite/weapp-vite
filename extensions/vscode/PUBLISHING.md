# 发布说明（VSCode Marketplace）

这个扩展通过仓库统一的 pnpm versioning + repoctl release 流程发布到 VS Code Marketplace，不再依赖 Changesets CLI 或独立的版本自动递增工作流。

## 1）设置 publisher

编辑 `extensions/vscode/package.json`：

- 确认 `"publisher"` 已设置为你的 Marketplace publisher id（当前仓库使用 `weapp-vite`）。

## 2）创建 publisher 与 PAT

- 在 https://marketplace.visualstudio.com/ 创建 publisher
- 创建带有 Marketplace 发布权限的 Azure DevOps Personal Access Token（PAT）

## 3）通过 repoctl 自动发布

在仓库 secrets 配置完成后：

- 当 `extensions/vscode` 有需要发布的改动时，通过 `pnpm change` 新增一条指向 `@weapp-vite/vscode` 的 change intent
- `.changeset/*.md` 是 pnpm change-intent 存储格式，不表示仓库仍使用 Changesets CLI
- Release PR 由 `repo release stable prepare` 生成，扩展版本号与 `CHANGELOG.md` 由 pnpm versioning 统一写入
- release PR 合并到 `main` 后，会触发 `.github/workflows/release.yml`
- `release.yml` 在 `main/alpha/beta/rc/next` 上统一执行 `repo release ci`；Marketplace hook 只在 `main` 实际运行
- npm 与 GitHub Release 处理完成后，repoctl 的 `afterPublish` hook 会执行根脚本 `release:vscode-marketplace`
- Marketplace 版本低于仓库版本时发布扩展，不受 tag 是否已存在影响
- Marketplace 已是当前版本但远端 tag 缺失时只补建 `vscode-extension-vX.Y.Z` tag；Marketplace 发布后 tag 推送失败也可由后续 workflow 单独恢复
- Marketplace 版本高于仓库版本时发布会明确失败并报告版本漂移
- 扩展是 private workspace 包，不发布到 npm；即使本轮没有 npm 包需要发布，repoctl 仍会执行 Marketplace hook

必须配置的仓库 secret：

- `VSCE_PAT`：Azure DevOps Marketplace 发布令牌

## 4）手动打包与发布

在仓库根目录执行：

```bash
cd extensions/vscode

# 先跑本地发布前校验
pnpm run check:publish

# 按远端 Marketplace 与 tag 状态执行幂等发布或恢复
pnpm run release:marketplace

# 编译 TypeScript 到 dist/
pnpm run build

# 本地生成 VSIX 产物
pnpm run package:dry-run

# 生成一个 .vsix 用于本地验证
npx @vscode/vsce package

# 登录并发布
npx @vscode/vsce login weapp-vite
npx @vscode/vsce publish
```

如果要通过脚本在本地发布：

```bash
VSCE_PAT=your_token pnpm run publish:vsce
```

说明：

- 源 `package.json` 使用 workspace 包名 `@weapp-vite/vscode`
- `publish:vsce` / `package:dry-run` 会复制到临时目录，并把最终提交给 Marketplace 的 manifest 重写为 `name = weapp-vite`
- 发布时同时会覆盖 `displayName = Weapp Vite`，避免 Marketplace 显示名冲突
- `pnpm run build` 使用 `tsdown` 将扩展运行时代码打包到 `dist/extension.js`
- `pnpm run test` 通过 Vitest 执行 TypeScript 单元测试
- `pnpm run smoke:dist` 会加载编译后的 `dist/extension.js`，并用模拟的 VS Code Host 验证扩展激活
- `pnpm run test:host:smoke` 会下载并启动真实 VS Code 宿主，执行最小插件烟测，适合放在 CI 中兜底安装后行为
- `pnpm run test:vsix:e2e` 会先生成本地 `.vsix`，再分别验证“仅安装 weapp-vite”和“安装 weapp-vite + Vue Official”两种安装态场景
- `pnpm run open:vsix:e2e:standalone` / `pnpm run open:vsix:e2e:vue-official` 可直接拉起对应安装态 VS Code，便于发布前手工检查；打开的工作区已经预置配置文件、分包、缺失页、未注册页、legacy `<json>` 页面、缺失组件和 `.wxml` 文件，适合集中回归插件入口
- `pnpm run check:vsix` 会打出本地 `.vsix`，并校验最终归档里的文件列表
- `check:publish` 已经包含 `lint`、`test` 和打包校验，是最稳妥的发布前关卡
- `release:marketplace` 会检测 Marketplace 线上版本与远端 tag，仅补齐缺失的发布状态；本地运行实际发布时必须处于 `main` 且配置 `VSCE_PAT`

## 推荐 CI 校验

至少保证 CI 执行：

```bash
pnpm --dir extensions/vscode run check:publish
```

如果希望进一步确认真实 VS Code 宿主能正常拉起扩展，建议在 CI 额外执行：

```bash
pnpm --dir extensions/vscode run build
pnpm --dir extensions/vscode run test:host:smoke
```

如果还想在 CI 或本地验证真实打包过程：

```bash
pnpm --dir extensions/vscode run package:dry-run
pnpm --dir extensions/vscode run test:vsix:e2e
```

这个仓库目前包含以下相关工作流：

- `.github/workflows/ci-vscode-extension.yml`
- `.github/workflows/release.yml`
