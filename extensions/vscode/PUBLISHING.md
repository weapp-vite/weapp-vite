# 发布说明（VSCode Marketplace）

这个扩展现在已经支持通过 GitHub Actions 自动补版本号并自动发布到 Marketplace。

## 1）设置 publisher

编辑 `extensions/vscode/package.json`：

- 确认 `"publisher"` 已设置为你的 Marketplace publisher id（当前仓库使用 `weapp-vite`）。

## 2）创建 publisher 与 PAT

- 在 https://marketplace.visualstudio.com/ 创建 publisher
- 创建带有 Marketplace 发布权限的 Azure DevOps Personal Access Token（PAT）

## 3）`main` 分支自动发布

在仓库 secrets 配置完成后：

- 合并到 `main` 且包含 `extensions/vscode` 可发布变更的提交，会触发 `.github/workflows/release-vscode-extension.yml`
- 工作流会读取本次 push 范围内的 Conventional Commits，并按以下规则计算版本号：
  - `major`：提交标题包含 `!`，或提交正文包含 `BREAKING CHANGE:`
  - `minor`：至少存在一条 `feat(...)` 提交
  - `patch`：其他任意可发布扩展变更
- 工作流会自动更新 `extensions/vscode/package.json` 和 `extensions/vscode/CHANGELOG.md`
- 随后执行 `pnpm --dir extensions/vscode run publish:vsce`
- 发布成功后，会把新的版本元数据提交回 `main`，并创建类似 `vscode-extension-v0.1.0` 的 git tag

必须配置的仓库 secret：

- `VSCE_PAT`：Azure DevOps Marketplace 发布令牌

## 4）手动打包与发布

在仓库根目录执行：

```bash
cd extensions/vscode

# 先跑本地发布前校验
pnpm run check:publish

# 只预览下一次自动发布的版本号，不改文件
pnpm run release:plan

# 在本地写入下一次版本号和 changelog
pnpm run release:apply

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

- `pnpm run build` 使用 `tsdown` 将扩展运行时代码打包到 `dist/extension.js`
- `pnpm run test` 通过 Vitest 执行 TypeScript 单元测试
- `pnpm run smoke:dist` 会加载编译后的 `dist/extension.js`，并用模拟的 VS Code Host 验证扩展激活
- `pnpm run check:vsix` 会打出本地 `.vsix`，并校验最终归档里的文件列表
- `check:publish` 已经包含 `lint`、`test` 和打包校验，是最稳妥的发布前关卡
- `release:plan` 会计算下一次发布级别，并在 CI 中写入 GitHub Actions 输出变量
- `release:apply` 会更新 `package.json`，并将 `## Unreleased` 下的内容消费为本次发布说明

## 推荐 CI 校验

至少保证 CI 执行：

```bash
pnpm --dir extensions/vscode run check:publish
```

如果还想在 CI 或本地验证真实打包过程：

```bash
pnpm --dir extensions/vscode run package:dry-run
```

这个仓库目前包含以下相关工作流：

- `.github/workflows/ci-vscode-extension.yml`
- `.github/workflows/release-vscode-extension.yml`
