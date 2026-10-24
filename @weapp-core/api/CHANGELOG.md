# @weapp-core/api

## 0.3.9

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@vitejs/devtools, @vitejs/devtools-kit, eslint, happy-dom, sass, sass-embedded。命名 catalog 变更键：无。

- fix(types): 为网络默认选项和 wevu 构建配置提供不加载小程序宿主全局声明的类型入口，保留现有运行时 API 和完整宿主类型别名。weapp-vite 配置使用可序列化的默认值类型，提前拒绝编译产物无法保留的回调、正则和其他非 JSON 值，避免污染 Node/Vite 配置的 DOM 与全局类型。补齐公开声明的依赖闭包，并通过原生声明打包消除路径选项中不符合 NodeNext 的上游导入。

- chore(deps): 升级兼容的 AI SDK、Vue 类型工具及构建依赖，同步脚手架依赖目录和应用模板。TypeScript 保持 6.0.3，截图比较算法及既有 Vite、Rolldown 兼容补丁保持原有契约。

  升级 pnpm、Bun 和 Rust JSON 序列化依赖，并迁移 repoctl 发布说明分类补丁；沿用上游已有的发布 PR 去重修复。

- chore(deps): 升级 Vue、React、Vitest、Rolldown、Oxc 与 AI SDK 等兼容依赖，同步应用、模板和脚手架 catalog。

  迁移 Rolldown 1.2.14 兼容补丁，并对齐 Rust Oxc 0.154.0；保留 Vite 8.3.4、DevTools/Kit 0.7.6、TypeScript 6.0.3 和截图比较语义，p-queue 更新至兼容的 9.3.5。

  默认 catalog 变更键：@icebreakers/eslint-config, @vue/compiler-core, @vue/compiler-dom, devframe, happy-dom, oxc-parser, postcss, react, rolldown, vue, weapp-tailwindcss, zod。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- chore(deps): 刷新兼容范围内的运行时与构建依赖。

  升级 AI SDK、TanStack Vue Query、Rollup、weapp-tailwindcss 及其 engine；VS Code 扩展的打包检查脚本改用 adm-zip 自带类型的运行时包。p-queue 与 pixelmatch 保持兼容版本，TypeScript 不在本轮升级范围内。默认 catalog 变更键为 weapp-tailwindcss，命名 catalog 变更键为 weapp-tailwindcss-fixed（均升级至 5.6.3）。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.vitest
  - @weapp-vite/glass-easel-web-adapter：devDependencies.vitest
  - @weapp-agent/cli：dependencies.@ai-sdk/anthropic、dependencies.@ai-sdk/openai、dependencies.@ai-sdk/openai-compatible、dependencies.ai
  - @weapp-vite/ast-native：devDependencies.vitest
  - @weapp-vite/eslint：devDependencies.vitest

## 0.3.8

### Patch Changes

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

## 0.3.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：dependencies.glass-easel-template-compiler
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/mcp：dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
  - @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
  - weapp-ide-cli：dependencies.@modelcontextprotocol/server
  - weapp-vite：dependencies.@weapp-tailwindcss/engine
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.3.6

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

## 0.3.5

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：tsx, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：oxc-parser。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：devDependencies.tsx

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser

## 0.3.4

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.3.3

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- 收紧 `wpiMock` 对同步与 Promise API 的 Vitest mock 方法类型约束。

## 0.3.2

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

## 0.3.1

### Patch Changes

- 修复微信同步返回 API 被错误 Promise 化的问题，补齐无 `Sync` 后缀 API 的运行时与类型契约。

## 0.3.0

### Minor Changes

- 新增类型安全的 Vitest API mock：支持通过 setup 子路径一次替换 `api` / `wpi`，也可使用独立 factory 与局部 reset；Promise、回调、同步和事件 API 均保留原类型契约，并同步提供 `@wevu/api` 与 `wevu/api` 兼容入口。

## 0.2.0

### Minor Changes

- 新增框架与运行时无关的 `@weapp-core/api` 多端小程序 API 代理包，支持内置宿主自动探测与显式 adapter 注入；`@wevu/api` 调整为兼容入口，继续保留 `wpi`、`createWeapi` 及既有类型导出。
