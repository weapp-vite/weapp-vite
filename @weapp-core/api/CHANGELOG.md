# @weapp-core/api

## 0.4.3

### Patch Changes

- chore(deps): 同步工程配置、AI SDK、Dashboard、Tailwind 与组件依赖。

  更新工作区与脚手架内置 catalog，采用 TDesign 1.18.0、weapp-tailwindcss 5.7.3 和 devframe 配套包 1.3.3，同步 ESLint、Stylelint、AI SDK、axios 及相关解析器。保持 TypeScript 6.0.3、Vite 8.3.5、Rolldown 1.2.16 和 Vite+ 1.5.0，保留原版本声明形式及公开 peer 最低兼容范围。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, ai, sass, sass-embedded, vue-router, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- chore(deps): 升级 AST、构建声明、脚手架和请求传输依赖。

  同步 Oxc JS 类型与可选 Rust 分析器至 0.158.0，更新 oxfmt 0.78.0、ignore 7.0.14、ws 8.22.2、dotenv 18.0.10 和 rolldown-plugin-dts 0.30.1。保留现有公开 API、类型契约及 native 的 JS fallback。

  声明构建改用 rolldown-plugin-dts 的 `dtsOnly`，消除默认构建中的弃用告警，保持声明产物契约。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - create-weapp-vite：dependencies.@inquirer/prompts

- Updated dependencies:
  - @weapp-core/types@1.2.3

## 0.4.2

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@tailwindcss/vite, tailwindcss, tsdown, vue-eslint-parser。命名 catalog 变更键：tailwind4(tailwindcss)。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, @tanstack/vue-query, ai, sass。命名 catalog 变更键：无。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@weapp-tailwindcss/engine, miniprogram-api-typings, sass-embedded, weapp-tailwindcss。命名 catalog 变更键：latest(miniprogram-api-typings)；weapp-tailwindcss-fixed(weapp-tailwindcss)。

  同步脚手架默认依赖和微信 API 清单，支持 typings 5.3.1 新增的六个接口。
  wevu 同步宿主实例查找的可空返回值、glass-easel 静态组件选项及生命周期错误参数类型，并补充公开类型契约验证。

- chore(deps): 升级编译、运行时与开发工具依赖并同步脚手架版本。

  本轮接受 58 个 npm 直接依赖升级目标，同步包内版本声明、默认 catalog、tailwind4 catalog 与脚手架模板，更新 Babel、Vue、Tailwind CSS、Oxc、AI SDK、Devframes、Vite+、Vitest 等编译、运行时和开发工具依赖。Rust Oxc 依赖与 JavaScript parser/types 同步到 0.157，保留原有版本前缀及公开 peer 兼容下限。

  将多包共用的依赖声明归并到 workspace catalog，并同步脚手架内置映射；精确版本、`^`、`~` 的原有范围和锁定结果保持一致，减少后续升级时的重复维护。

  Vite+ 更新到 1.5.0，内置 Vite 8.3.5 与 Vitest 5.1.0。独立 Vite 8.3.6 未通过优化器关闭生命周期诊断，本轮保留 8.3.5；TypeScript 及其余兼容保留项继续沿用原基线。

  修复内联 WXS/SJS 在 Vue SFC、Web 转换和 HMR 解析中的原始脚本保护，保留行注释、运算符与标签字面量，避免组件扫描误读脚本正文。复用统一脚本边界解析，不增加公共 API。

  补齐 VS Code 扩展构建中的 WXML 源码解析依赖，缺失的模块会阻断构建，避免生成不完整的扩展包。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @wevu/web-apis：dependencies.web-streams-polyfill
  - create-weapp-vite：devDependencies.oxfmt
  - weapp-vite：dependencies.rolldown-plugin-dts

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-agent/cli：dependencies.commander
  - weapp-vite：dependencies.@volar/language-service
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- fix(weapp-vite): 修复启用原生插槽上下文时，应用外壳和无脚本 Vue 布局的模板事件缺少对应组件处理方法的问题，并补齐 owner 所需运行时能力及构建重建支持。

  移除 API 映射中结果相同的冗余名单查询，让诊断专用数据可从运行时裁剪，保留原有跨平台映射、adapter 和诊断行为。

  修复 watch 扫描平台配置目录时子文件被删除导致构建报错的竞态，保留根目录和其他文件系统错误。同步流适配器的 4.5.1 版本契约及状态布局回归。

- Updated dependencies:
  - @weapp-core/types@1.2.2

## 0.4.1

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

  修复 classic HMR 的来源证明：React 普通 JSX/TSX 在转换前记录实际输入，原生入口继续由 raw reader 独占；保存事件以 Vite 同次稳定读取结算摘要，避免文件截断阶段污染恢复版本，并保留晚到读取、后续保存和关闭之间的所有权隔离。

  减少 request globals 与 prelude 的构建期重复解析：复用同一产物的 installer 识别结果，先检查已有 runtime 标记，并仅对完全缺少标记、公共导出和转义线索的代码跳过 AST；保留转义输入、跨轮次替换、初始化顺序和原生输出契约。

- fix(types): 由共享类型包提供模块内的完整官方小程序声明，在消费者显式加载官方声明时保留原生类型身份，修复 API、运行时及 i18n 在独立 Node、DOM 与 Vitest 消费者中的全局冲突和类型入口缺失。

- Updated dependencies:
  - @weapp-core/types@1.2.1

## 0.4.0

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
