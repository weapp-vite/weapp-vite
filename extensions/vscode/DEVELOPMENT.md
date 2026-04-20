# Weapp Vite VS Code 扩展开发指南

本文档面向扩展维护者与仓库贡献者，说明本地安装、调试、构建、测试、打包和发布相关事项。

## 1. 本地安装与验证

### 1.1 从仓库安装扩展

1. 打开 VS Code 命令面板，执行 `Developer: Install Extension from Location...`
2. 选择 `extensions/vscode`
3. 重新加载窗口

### 1.2 验证 `<json>` 自定义块高亮

在 `.vue` 文件的 `<json>` 块内执行 `Developer: Inspect Editor Tokens and Scopes`。

- 预期 `textmate scopes` 中包含 `source.json.comments`
- 适用于 `<json>`、`lang="json"`、`lang="jsonc"`、`lang="json5"`

## 2. 代码结构

| 路径                                       | 说明                       |
| ------------------------------------------ | -------------------------- |
| `extensions/vscode/extension.ts`           | 扩展入口                   |
| `extensions/vscode/extension/**/*.ts`      | 扩展运行时代码             |
| `extensions/vscode/extension/**/*.test.ts` | 单元测试                   |
| `extensions/vscode/scripts/*.ts`           | 构建、打包、校验和发布脚本 |

## 3. 常用本地命令

在仓库根目录执行：

```bash
pnpm --dir extensions/vscode run build
pnpm --dir extensions/vscode run test
pnpm --dir extensions/vscode run test:host:smoke
pnpm --dir extensions/vscode run test:vsix:e2e
pnpm --dir extensions/vscode run test:vsix:e2e:standalone
pnpm --dir extensions/vscode run test:vsix:e2e:vue-official
pnpm --dir extensions/vscode run open:vsix:e2e:standalone
pnpm --dir extensions/vscode run open:vsix:e2e:vue-official
pnpm --dir extensions/vscode run smoke:dist
pnpm --dir extensions/vscode run check:package
pnpm --dir extensions/vscode run check:vsix
pnpm --dir extensions/vscode run check:publish
pnpm --dir extensions/vscode run release:marketplace:plan
```

## 4. 构建与测试说明

### 4.1 构建

- `build` 使用 `tsdown` 将扩展运行时代码打包为 `dist/extension.js`
- 源码 `package.json` 使用 workspace 包名 `@weapp-vite/vscode`

### 4.2 运行时验证

- `smoke:dist` 会用模拟的 VS Code API 加载编译产物 `dist/extension.js`
- `test:host:smoke` 会在真实 VS Code 宿主中运行最小 smoke 测试
- `test:vsix:e2e` 会顺序执行两个安装态 e2e 场景：仅安装 `weapp-vite`，以及安装 `weapp-vite` + `Vue Official`
- `test:vsix:e2e:standalone` 只验证“仅安装 `weapp-vite`”场景
- `test:vsix:e2e:vue-official` 只验证“安装 `weapp-vite` + `Vue Official`”场景
- `open:vsix:e2e:standalone` / `open:vsix:e2e:vue-official` 会直接拉起对应场景的独立 VS Code，便于手工复现和联调
- 这些命令打开的是同一个“覆盖型” `weapp-vite` fixture：里面同时包含 `package.json` scripts、`vite.config.ts`、`weapp-vite.config.ts`、`src/app.json`、已注册页面、缺失页面、未注册页面、分包页面、legacy `<json>` 页面、现存/缺失 `usingComponents`、以及独立 `.wxml` 文件

### 4.3 打包校验

- `check:package` 用于校验运行时入口和打包排除项
- `check:vsix` 会生成本地 `.vsix` 并校验归档文件列表
- `check:publish` 已包含 lint、test、build 和打包校验，是最稳妥的发布前检查

## 5. 发布说明

扩展版本通过 changeset 驱动，Marketplace 发布说明单独维护在：

- [PUBLISHING.md](./PUBLISHING.md)

目前 release 流程已经限制为仅允许在 `main` ref 上执行实际 Marketplace 发布，未合并的 `changeset-release/*` 分支不会直接发布。
