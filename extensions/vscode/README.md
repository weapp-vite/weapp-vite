# weapp-vite：面向实战的 VS Code 支持

这个 VS Code 扩展提供了：

- `.vue` 文件中 weapp-vite `<json>` 自定义块的语法高亮
- 识别到 weapp-vite 工作区后的状态栏入口
- `dev` / `build` / `generate` / `open` / `info` 等常用工作区命令
- `<json>` 块和 `defineConfig` 的代码片段
- 面向 `package.json`、`vite.config.*`、`.vue` 的代码操作
- 对常用脚本缺失情况的轻量 `package.json` 诊断
- 在关键 weapp-vite 文件中的悬浮信息、上下文补全和文档快捷入口
- 状态栏、诊断、悬浮、补全和 CLI 别名偏好的用户配置
- 最近命令执行日志输出面板

## 从仓库安装

1. 打开 VS Code 命令面板，执行 `Developer: Install Extension from Location...`
2. 选择 `extensions/vscode`
3. 重新加载窗口

## 验证

在 `.vue` 文件的 `<json>` 块内执行 `Developer: Inspect Editor Tokens and Scopes`。

- 预期 `textmate scopes` 中包含 `source.json.comments`（适用于 `<json>`、`lang="json"`、`lang="jsonc"`、`lang="json5"`）。

## 项目识别

扩展会在工作区中检测以下一种或多种信号，并将其识别为 weapp-vite 项目：

- `package.json` 依赖中包含 `weapp-vite` 或 `create-weapp-vite`
- `package.json` scripts 中调用了 `wv` 或 `weapp-vite`
- 本地 `vite.config.*` 中引用了 `weapp-vite`
- `src/app.json` 或 `app.json` 作为补充上下文存在

识别成功后，状态栏会显示 `weapp-vite` 入口按钮。

## 命令

打开命令面板后可以执行：

- `weapp-vite: Run Action`
- `weapp-vite: Dev`
- `weapp-vite: Build`
- `weapp-vite: Generate`
- `weapp-vite: Open DevTools`
- `weapp-vite: Doctor / Info`
- `weapp-vite: Show Project Info`
- `weapp-vite: Show Output`
- `weapp-vite: Open Docs`

扩展会按以下顺序解析命令：

1. 优先使用匹配的 `package.json` scripts，例如 `dev`、`build`、`open`、`generate`、`g`、`doctor`、`info`
2. 如果未命中，则回退到 `wv <command>`

终端工作目录会优先取当前活动编辑器所在的工作区目录，否则取第一个打开的工作区目录。

## 代码片段

- `wv-json`：插入 `<json lang="jsonc">...</json>` 自定义块
- `wv-config`：插入 `defineConfig` 基础骨架
- `wv-scripts`：向 `package.json` 插入 weapp-vite 常用脚本

## 编辑器能力

扩展还提供了以下实用编辑器能力：

- 在 `.vue` 中通过代码操作或补全插入 `weapp-vite` `<json>` 块
- 在 `vite.config.*` 中执行 `weapp-vite: Insert defineConfig Template`
- 在 `package.json` 中执行 `weapp-vite: Insert Common Scripts`
- 当 `package.json` 已明显是 weapp-vite 项目但缺少常用脚本时，编辑器会给出信息级诊断
- 悬浮到常用脚本项、`defineConfig`、`generate` 或 `<json>` 块时，可看到轻量提示
- 在 `package.json` 中，补全会建议常用 script key 和 `wv` 命令值
- 在 `vite.config.*` 中，补全会建议 `defineConfig`、`generate` 和 `plugins` 骨架

## 配置项

扩展暴露了一组简洁的配置：

- `weapp-vite.showStatusBar`
- `weapp-vite.enablePackageJsonDiagnostics`
- `weapp-vite.enableHover`
- `weapp-vite.enableCompletion`
- `weapp-vite.preferWvAlias`

如果你更偏好显式 CLI 名称而不是别名，可以关闭 `weapp-vite.preferWvAlias`，此时扩展会生成 `weapp-vite dev` 风格的命令，而不是 `wv dev`。

## 打包

扩展清单目前包含：

- 面向发布的 `files` 白名单
- 输出到 `dist/extension.js` 的 `tsdown` 构建配置
- 本地 `lint`、`vitest` 与 `check` 脚本
- 用于发布前校验的 `check:publish`
- 用于在 release 流程中判断是否需要发布 Marketplace 的 `release:marketplace:plan`
- 用于校验运行时入口和打包排除项的 `check:package`
- 用于本地生成 `.vsix` 产物的 `package:dry-run`
- 面向 Marketplace 手动发布的 `publish:vsce`
- 首次使用的简洁上手说明
- 用于减少无关命令暴露的命令面板可见性规则
- 独立的 VS Code 扩展 GitHub Actions 工作流

## TypeScript

扩展运行时代码与单元测试都使用 TypeScript：

- 源码入口：`extensions/vscode/extension.ts`
- 运行时模块：`extensions/vscode/extension/**/*.ts`
- 单元测试：`extensions/vscode/extension/**/*.test.ts`
- 脚本文件：`extensions/vscode/scripts/*.ts`

常用本地命令：

```bash
pnpm --dir extensions/vscode run build
pnpm --dir extensions/vscode run test
pnpm --dir extensions/vscode run release:marketplace:plan
pnpm --dir extensions/vscode run smoke:dist
pnpm --dir extensions/vscode run check:package
pnpm --dir extensions/vscode run check:vsix
```

`build` 会通过 `tsdown` 将扩展运行时打成单个 CommonJS 入口，测试则继续通过 Vitest 直接执行 TypeScript 源码。
构建完成后，`smoke:dist` 会使用模拟的 VS Code API 加载编译产物 `dist/extension.js`，确认激活链路仍然正常。
如果要检查最终 Marketplace 产物内容，可执行 `check:vsix`，它会生成本地 `.vsix` 并校验归档文件列表。
源码 `package.json` 使用 workspace 包名 `@weapp-vite/vscode`，而 `publish:vsce` / `package:dry-run` 会在临时目录中把发布 manifest 重写成 Marketplace 使用的 `weapp-vite` 与 `Weapp Vite`。

## 发布

扩展版本现在通过 changeset 驱动，合并 release PR 后会在仓库统一的 `release.yml` 中自动发布到 VS Code Marketplace。
详见 `extensions/vscode/PUBLISHING.md`。
