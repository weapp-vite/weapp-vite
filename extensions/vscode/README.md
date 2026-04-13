# Weapp Vite

面向 `weapp-vite` 项目的 VS Code 官方扩展。

它把日常高频动作直接放进编辑器里：识别项目、展示状态栏入口、执行 `dev/build/generate/open`、补齐常用脚本、增强 `vite.config.*` / `package.json` / `.vue` 的编辑体验，并为 weapp-vite 的 `<json>` 自定义块提供语法高亮与代码片段。

## 官方入口

- 官方仓库：https://github.com/weapp-vite/weapp-vite
- 插件目录：https://github.com/weapp-vite/weapp-vite/tree/main/extensions/vscode
- 使用文档：https://github.com/weapp-vite/weapp-vite/tree/main/website
- 问题反馈：https://github.com/weapp-vite/weapp-vite/issues

## 适合谁

- 正在使用 `weapp-vite` 开发微信小程序或多端小程序项目的开发者
- 希望在 VS Code 里直接触发 `weapp-vite` 常用命令的团队
- 需要更顺手地编写 `.vue`、`vite.config.*`、`package.json` 的项目成员

## 核心能力

- `.vue` 文件中 weapp-vite `<json>` 自定义块的语法高亮
- 识别到 weapp-vite 工作区后的状态栏入口
- `dev` / `build` / `generate` / `open` / `info` 等常用工作区命令
- `<json>` 块和 `defineConfig` 的代码片段
- 面向 `package.json`、`vite.config.*`、`.vue` 的代码操作
- 对常用脚本缺失情况的轻量 `package.json` 诊断
- 在关键 weapp-vite 文件中的悬浮信息、上下文补全和文档快捷入口
- 状态栏、诊断、悬浮、补全和 CLI 别名偏好的用户配置
- 最近命令执行日志输出面板

## 快速开始

1. 在 VS Code 中安装 `Weapp Vite` 扩展。
2. 打开一个 `weapp-vite` 项目。
3. 看到状态栏出现 `weapp-vite` 入口后，打开命令面板执行 `weapp-vite: Run Action`。
4. 按需执行 `Dev`、`Build`、`Generate`、`Open DevTools` 等常用动作。

如果你正在从仓库本地调试，也可以直接使用下面的方式安装：

## 从仓库安装

1. 打开 VS Code 命令面板，执行 `Developer: Install Extension from Location...`
2. 选择 `extensions/vscode`
3. 重新加载窗口

## 验证

在 `.vue` 文件的 `<json>` 块内执行 `Developer: Inspect Editor Tokens and Scopes`。

- 预期 `textmate scopes` 中包含 `source.json.comments`（适用于 `<json>`、`lang="json"`、`lang="jsonc"`、`lang="json5"`）。

## 项目识别

扩展会在工作区中检测以下一种或多种信号，并将其识别为 weapp-vite 项目：

- `package.json` 依赖中包含 `weapp-vite`
- `package.json` scripts 中调用了 `wv` 或 `weapp-vite`
- 本地 `vite.config.*` 中引用了 `weapp-vite`
- `src/app.json` 或 `app.json` 作为补充上下文存在

识别成功后，状态栏会显示 `weapp-vite` 入口按钮。

## 为什么推荐安装

- 把常用 CLI 动作前移到编辑器内，减少反复切换终端
- 对 `weapp-vite` 项目的关键文件提供更贴近场景的补全与提示
- 新成员进入项目时，可以更快找到命令入口、文档入口和基础配置骨架

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
- `weapp-vite: Open Project File`
- `weapp-vite: Copy Current Page Route`
- `weapp-vite: Reveal Current Page In app.json`
- `weapp-vite: Create Page From Route`
- `weapp-vite: Open Page From Route`
- `weapp-vite: Add Current Page To app.json`
- `weapp-vite: Insert definePageJson Template`

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
- 在 `.vue` 中执行 `weapp-vite: Insert definePageJson Template`，快速插入页面配置骨架
- 在 `vite.config.*` 中执行 `weapp-vite: Insert defineConfig Template`
- 在 `package.json` 中执行 `weapp-vite: Insert Common Scripts`
- 在任意 weapp-vite 工作区中执行 `weapp-vite: Open Project File`，快速跳到 `package.json`、`vite.config.*`、`app.json` 和已声明页面
- Explorer 侧边栏新增 `weapp-vite Pages` 视图，按顶层页面、分包页面、未声明页面分组浏览项目页面结构
- 在 `weapp-vite Pages` 视图中点击页面节点时，可直接打开页面文件；若页面声明存在但文件缺失，则直接打开 `app.json`
- `weapp-vite Pages` 视图右键可直接执行页面修复动作，包括创建缺失页面、把未声明页面加入 `app.json`、定位声明和复制 route
- 在页面文件中执行 `weapp-vite: Copy Current Page Route`，快速复制当前页面 route
- 在页面文件中执行 `weapp-vite: Reveal Current Page In app.json`，直接跳到 `app.json` 中的声明位置
- 在 `app.json` 的缺失页面路由上执行 `weapp-vite: Create Page From Route`，直接生成对应 `.vue` 页面骨架
- 在 `app.json` 的已存在页面路由上执行 `weapp-vite: Open Page From Route`，直接跳到对应页面文件
- 在页面文件中执行 `weapp-vite: Add Current Page To app.json`，直接把当前页面加入顶层或匹配的分包页面声明
- 在 `app.json` 的 `pages` / `subPackages` / `subpackages` 中补全已有页面 route，减少手动输入和路径拼写错误
- 悬浮在 `app.json` 的页面 route 上时，可直接看到对应页面文件是否存在，以及扩展实际尝试匹配的页面文件路径
- 在 `app.json` 里可直接 `Cmd/Ctrl + Click` 已存在的页面 route，跳转到对应页面文件
- 当页面 `.vue` 已能识别为页面文件但尚未声明到 `app.json` 时，编辑器会直接在当前页面给出诊断和补齐入口
- 当页面同时使用 `definePageJson` 和 `<json>` 且关键配置不一致时，编辑器会直接在当前页面提示不一致诊断
- 检测到 `definePageJson` 与 `<json>` 的标题配置不一致时，可直接通过 quick fix 把 `<json>` 标题同步为 `definePageJson`
- 同样也支持反向 quick fix，把 `definePageJson` 标题同步为 `<json>`，避免只能单向修复
- 如果其中一侧缺少 `navigationBarTitleText`，同步 quick fix 也会自动补齐，而不只是覆盖已有值
- `navigationStyle` 也会参与双写一致性检查，并提供双向同步 quick fix，减少页面配置漂移
- `enablePullDownRefresh` 这类布尔页面字段现在也会做双写一致性诊断和双向同步
- 在 `vite.config.*` 中按所在层级补全 `weapp`、`generate`、`dirs`、`extensions`、`filenames` 等常用配置骨架
- 在页面 `.vue` 的 `<json>` 自定义块中补全常用页面字段，如 `navigationBarTitleText`、`enablePullDownRefresh`、`backgroundColor`
- 在页面 `.vue` 的 `definePageJson({...})` 中也可补全常用页面字段，减少在脚本配置里手写键名
- 在页面 `.vue` 的 `definePageJson({...})` 和 `<json>` 配置里，常用枚举值与布尔值也会给出上下文补全
- 悬浮到 `definePageJson` 或常用页面配置键时，可直接查看字段说明，减少来回翻文档
- 在页面 `.vue` 中，只有缺少 `definePageJson(...)` 或缺少 `<json>` 块时，才会出现对应的补齐 code action，减少重复提示
- 在页面文件里执行 `weapp-vite: Run Action` 时，会优先展示当前页面相关动作，并带出当前 route 与声明状态，减少在通用命令中来回筛选
- 当 `package.json` 已明显是 weapp-vite 项目但缺少常用脚本时，编辑器会给出信息级诊断
- 当 `app.json` 声明了不存在的页面路径时，编辑器会提示缺失的页面文件
- 悬浮到常用脚本项、`defineConfig`、`generate` 或 `<json>` 块时，可看到轻量提示
- 在 `package.json` 中，补全会建议常用 script key 和 `wv` 命令值
- 在 `vite.config.*` 中，补全会建议 `defineConfig` 以及 `weapp`、`generate`、`dirs`、`extensions`、`filenames` 等常用配置骨架

## 配置项

扩展暴露了一组简洁的配置：

- `weapp-vite.showStatusBar`
- `weapp-vite.enablePackageJsonDiagnostics`
- `weapp-vite.enableAppJsonDiagnostics`
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
