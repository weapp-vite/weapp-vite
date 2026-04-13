# 发布说明（VSCode Marketplace）

这个扩展现在通过仓库统一的 changeset release 流程发布到 VS Code Marketplace，不再使用独立的版本自动递增工作流。

## 1）设置 publisher

编辑 `extensions/vscode/package.json`：

- 确认 `"publisher"` 已设置为你的 Marketplace publisher id（当前仓库使用 `weapp-vite`）。

## 2）创建 publisher 与 PAT

- 在 https://marketplace.visualstudio.com/ 创建 publisher
- 创建带有 Marketplace 发布权限的 Azure DevOps Personal Access Token（PAT）

## 3）通过 changeset 自动发布

在仓库 secrets 配置完成后：

- 当 `extensions/vscode` 有需要发布的改动时，新增一条指向 `@weapp-vite/vscode` 的 changeset
- release PR 由仓库统一的 changeset 流程生成，扩展版本号与 `CHANGELOG.md` 也由该流程统一写入
- release PR 合并到 `main` 后，会触发 `.github/workflows/release.yml`
- `release.yml` 会先执行现有 npm release 流程，再检查 `extensions/vscode/package.json` 是否在本次 release 中发生版本变化
- 如果扩展版本有变化且对应 tag 尚不存在，则执行 `pnpm --dir extensions/vscode run publish:vsce`
- 发布成功后，会创建类似 `vscode-extension-v0.1.0` 的 git tag，但不会发布到 npm

必须配置的仓库 secret：

- `VSCE_PAT`：Azure DevOps Marketplace 发布令牌

## 4）手动打包与发布

在仓库根目录执行：

```bash
cd extensions/vscode

# 先跑本地发布前校验
pnpm run check:publish

# 查看当前提交是否会在 release 流程里触发 Marketplace 发布
pnpm run release:marketplace:plan

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
- `pnpm run check:vsix` 会打出本地 `.vsix`，并校验最终归档里的文件列表
- `check:publish` 已经包含 `lint`、`test` 和打包校验，是最稳妥的发布前关卡
- `release:marketplace:plan` 会检测当前版本是否在本次 release 中变化，并在 CI 中写入 GitHub Actions 输出变量

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
```

这个仓库目前包含以下相关工作流：

- `.github/workflows/ci-vscode-extension.yml`
- `.github/workflows/release.yml`
