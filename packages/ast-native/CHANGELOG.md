# @weapp-vite/ast-native

## 0.2.1

### Patch Changes

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-core/types：devDependencies.tsdown
  - @weapp-vite/glass-easel-web-adapter：devDependencies.tsdown
  - @wevu/web-apis：devDependencies.eventsource-parser
  - @weapp-agent/cli：dependencies.@ai-sdk/anthropic、dependencies.@ai-sdk/openai、dependencies.@ai-sdk/openai-compatible、dependencies.ai、devDependencies.tsdown
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - create-weapp-vite：dependencies.@inquirer/prompts
  - @weapp-vite/dashboard：dependencies.@devframes/agentic、dependencies.@devframes/hub、dependencies.@devframes/hub-ui
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/miniprogram-automator：dependencies.ws
  - weapp-vite：dependencies.@typescript-eslint/parser、dependencies.rolldown-plugin-dts、devDependencies.@devframes/agentic、devDependencies.@devframes/hub、devDependencies.@devframes/hub-ui、optionalDependencies.@swc/core

  chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @icebreakers/eslint-config, @types/node, @vue/language-core, autoprefixer, axios, devframe, eslint, magic-string, oxc-parser, postcss, rolldown, sass, sass-embedded, tailwind-variants, tslib, uview-plus, vue-tsc。命名 catalog 变更键：无。

  迁移 rolldown-plugin-dts 0.29 的 tsc 配置命名空间，兼容旧顶层配置，保留项目引用、上下文隔离和 Vue 声明生成契约。Rust N-API 与 Oxc 配套升级，保留可选原生路径及 JavaScript fallback；SSE 与样式变体由回归覆盖。TypeScript 保留 6.0.3，Node 支持范围不变。

- fix(ast-native): 打包前按 Cargo.lock 构建当前宿主的原生模块，避免隔离源码发布时漏掉二进制文件。

## 0.2.0

### Minor Changes

- chore(deps)!: 升级工具链依赖，更新 Node.js 支持范围与升级提醒。

  Node.js 官方支持范围为 `^22.23.4 || ^24.22.1 || >=26.12.1`，发布包与生成项目的 `engines.node` 使用此范围。Vite+ 仍使用 `^24.22.1 || >=26.12.1`。

  `weapp-vite` 的 `build`、`dev`、`prepare`、`accept`、`mcp` 和 Tailwind 集成在范围外提示升级并继续运行。提醒通过 stderr 输出中文，按终端颜色设置突出当前版本和推荐范围，并提示“建议升级到受支持 LTS 分支的最新补丁版本，以获得安全修复”；Tailwind 每个插件实例只提醒一次。

  依赖加载、构建和 CSS 入口错误仍按原有方式处理，`prepare` 保留既有容错行为；允许尝试运行不代表承诺兼容所有旧版本。Bun 按独立运行时识别，不因其 Node 兼容版本触发提醒。入门与随包文档同步说明这一行为。

  修复仓库首次安装时，`wv prepare` 因日志依赖尚未构建而提前退出的问题。中文与颜色提示在 workspace 包尚无构建产物时也能正常加载；CLI 尚未构建时仍提示跳过支持文件预生成，不阻断安装。

  此次升级还修复了 Web 路由目录重命名时的重复 reload，以及 Wot UI 2.4.0 宽屏裁剪器白屏问题。TypeScript 编译器版本保持不变。

  升级时请检查以下迁移要求：

  公开构建队列升级至 p-queue 10：事件监听改用 `addEventListener` / `removeEventListener`，事件值从 `event.detail` 读取；清空队列会以 `AbortError` 拒绝尚未执行的任务。

  截图比较升级至 pixelmatch 8 的 OKLab/HyAB 算法：相同阈值可能得到不同差异结果，请保留现有阈值并重新复核截图基线。

  Chokidar 6 自有监听器通过 `build.watch.chokidar` 配置 `backend`、`pollingInterval`、`pollingBinaryInterval`，兼容旧 polling 别名。`server.watch` 仍由 Vite 管理，Rolldown 原生监听选项使用 `build.watch.watcher`。

  本轮依赖升级沿用已确认的发布例外，该条目覆盖 40 个 minor 和 2 个 patch，不代表完全向后兼容。具体依赖版本和迁移步骤见 `docs/plans/2026-10-26-dependency-upgrade.md`。

## 0.1.10

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@vitejs/devtools, @vitejs/devtools-kit, eslint, happy-dom, sass, sass-embedded。命名 catalog 变更键：无。

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

## 0.1.9

### Patch Changes

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

## 0.1.8

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 升级 Vite、Rolldown、Tailwind 构建链及 Dashboard、MCP、自动化工具的相关依赖，保持共享依赖版本一致，并同步脚手架模板使用的依赖 catalog。迁移 uview-plus 3.8.125 兼容补丁，仅保留条码实例 $nextTick 等待。保留 TypeScript 6 与现有环境变量展开语义。

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

## 0.1.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

## 0.1.6

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

## 0.1.5

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.1.4

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

## 0.1.3

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

## 0.1.2

### Patch Changes

- 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.vitest
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli、devDependencies.vitest
  - @weapp-vite/eslint：devDependencies.vitest

## 0.1.1

### Patch Changes

- 将模板与 JSX 的 `warnings` 升级为带 code、severity 和 loc 的结构化 `diagnostics`，并支持完整 SFC 源码定位。同步补充 Vue 语义对齐与 fuzz 回归，移除无稳定收益的 native SFC 接入，优化诊断热路径和编译器分发体积。

## 0.1.0

### Minor Changes

- 将 SFC HMR 语义下沉到 `@wevu/compiler`，新增 script、template、style、config block 级签名与变更分类，并扩展可选 native 载荷保持同构回退。`weapp-vite` 仅保存编译器快照并继续通过 `ModuleGraphService` 传播失效；脚本文本候选分析统一由 `@weapp-vite/ast` 提供。

## 0.0.8

### Patch Changes

- 将包主页、随包文档、脚手架默认链接与小程序 JSON Schema 地址统一迁移到 `vite.weapp.dev`，确保新生成项目和公开元数据使用新的文档主域名。

## 0.0.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@vue/language-core, eslint, vue-tsc。命名 catalog 变更键：无。

## 0.0.6

### Patch Changes

- 升级 Oxc 与 Vitest 依赖，并将脚手架模板使用的 weapp-tailwindcss 版本同步至 5.3.1，确保发布包和新建项目采用一致的依赖基线。

## 0.0.5

### Patch Changes

- 🐛 **自动补充依赖升级发布记录。** [`4197538`](https://github.com/weapp-vite/weapp-vite/commit/4197538abacf278136db75cdb1e84c4cfb88c5a8) by @sonofmagic
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

## 0.0.4

### Patch Changes

- 🐛 **升级除 TypeScript 外的依赖与 pnpm，并适配 Vite 8 的 OXC JSX 转换：已有 `esbuild.jsx: 'preserve'` 配置会同步到 OXC，避免 Wevu JSX 被误转换为 React runtime。** [#772](https://github.com/weapp-vite/weapp-vite/pull/772) by @sonofmagic
  升级至 `weapp-tailwindcss@5.2.11`，采用上游对 Tailwind v4 生成器 module ID 查询的统一清理，避免 `weapp-vite` 样式 sidecar 虚拟模块 ID 被当作磁盘路径读取，确保原生模板、脚本和样式增量更新正常输出。

  涉及包：
  - @wevu/api：dependencies.@douyin-microapp/typings
  - @weapp-vite/web：dependencies.rolldown
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - @weapp-vite/dashboard：devDependencies.@iconify/tailwind4
  - @weapp-vite/miniprogram-automator：dependencies.ws
  - rolldown-require：dependencies.get-tsconfig
  - weapp-ide-cli：dependencies.execa
  - weapp-vite：dependencies.@vercel/detect-agent、dependencies.rolldown-plugin-dts
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.0.3

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`98aa0bc`](https://github.com/weapp-vite/weapp-vite/commit/98aa0bcce2aa02df4ef6760f382143240dd76c17) by @sonofmagic
  - 默认 catalog 变更键：@types/node, miniprogram-api-typings, oxc-parser, postcss, tailwind-variants, weapp-tailwindcss。命名 catalog 变更键：latest(miniprogram-api-typings)；weapp-tailwindcss-fixed(weapp-tailwindcss)。

## 0.0.2

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`71e0e70`](https://github.com/weapp-vite/weapp-vite/commit/71e0e70cc7a466d67236a406d47f261ac57c815b) by @sonofmagic
  - 默认 catalog 变更键：@vue/language-core, oxc-parser, postcss, rolldown, sass, stylelint, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
  - 同时适配 Monaco Editor 0.56 的 worker 公开入口，恢复 Dashboard 构建。

## 0.0.1

### Patch Changes

- 🐛 **新增可选的 native AST 批量分析与性能评估能力，将同一份脚本上的多项静态检查合并为一次 JS 与 Rust 通信和一次解析，并在 bundle rewrite 热路径复用分析缓存。native binding 未配置、加载失败或执行失败时继续回退 Babel、Oxc 与 Vue compiler 路径，保持现有构建兼容性。** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc) by @sonofmagic
