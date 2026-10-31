# @wevu/test-utils

## 1.1.1

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

- Updated dependencies:
  - @weapp-core/constants@0.5.1
  - @wevu/compiler@7.7.1
  - wevu@7.7.1

## 1.1.0

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

### Patch Changes

- feat: 支持在微信小程序中使用 Fetch 响应流和 EventSource。

  `@wevu/web-apis` 与 `wevu` 支持增量 UTF-8 解码、标准流消费和取消，以及 SSE 事件解析与重连，可复用 Web 的 Fetch 响应流和 `EventSource` 写法。

  `weapp-vite` 在第三方模块执行前注入所需构造器，避免依赖在初始化时找不到相关 API。

  宿主缺少早期真实 HTTP 状态码或分块 API 时，会明确报告能力限制；普通缓冲请求和现有 Wevu 入口继续可用。

- fix(web): 保留 data-* 完整表达式的原始值类型。

  编译模板与旧字符串模板的事件、组件事件、选择器和交叉观察器保留数字、布尔值、对象及数组，修复这些值被字符串化的问题；DOM 属性仍可按字符串查询，更新、移除和重新连接时读取保持正确。

  HTML 属性名按 DOM 的 ASCII 大小写规则归一，避免 `data-itemName` 与 `data-item-name` 串值；SVG/XML 保留大小写敏感语义。

  模拟器的交叉观察器回调同样保留 dataset 原始值类型，与事件和选择器读取保持一致。

- Updated dependencies:
  - @weapp-core/constants@0.5.0
  - @wevu/compiler@7.7.0
  - wevu@7.7.0

## 1.0.1

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

- fix: 修复 JSX/TSX 模板热更新绕过注册能力检查、导致页面数据与实际渲染不一致的问题。共享模板、内联事件、计算绑定和动态岛注册语义变化时切换为完整重载，纯方法脚本更新继续保留状态；跨文件静态展开同时沿用当前构建的冻结源码，避免读取后续保存的内容。模拟器增加显式编译模板注册与提交能力，避免仅修改磁盘文件就被误判为宿主模板已更新。

  修复 Wevu、Tailwind CSS 与 TDesign 模板的 npm 文件筛选，保留组件入口实际引用的 `type.js`、配置状态管理和语言包等完整传递依赖，避免 classic 完整发布存在悬空模块依赖；零售模板与示例使用显式媒体组件入口，并检查产物路径完整；脚手架同步提供修正后的模板。

  React 静态模板和 dynamic 模板更新目前均缺少经真实微信宿主验证的状态保留能力，统一按编译结果明确切换为 classic；解析错误与编译错误继续报告。请求的 HMR 模式配置保持原值，后续修改沿用本次开发会话的 classic 决策。

  React 自动渲染选择仅对编译器明确声明不支持的合法结构退回 dynamic；语法、内部编译和原生 bridge 错误保持失败并保留上一份完整模板，不再被包装成成功回退。

  原生 Vue 的 Patch 与 Noop 交付统一根据冻结源码判断模板和样式变化，避免 Tailwind 内容通知覆盖样式分类后继续发布旧 CSS；纯脚本修改仍保留无需视觉快照编译的路径。

  classic 开发发布以完整产物内容更新 App 入口，让微信开发者工具自动完整重载，避免后续 TSX 混合模板和脚本保存出现新事件逻辑配旧模板；保持用户原有热重载开关，stateful 支持的更新继续保留状态。

- Updated dependencies:
  - @weapp-core/constants@0.4.0
  - @wevu/compiler@7.6.0
  - wevu@7.6.0

## 1.0.0

### Major Changes

- feat(engines)!: 将框架及编译依赖链的 Node.js 支持范围对齐为 `^22.18.0 || ^24.11.0 || >=26.0.0`，不再承诺 Node 20、23、25 或低于最低补丁版本的环境。CLI 在加载构建依赖前读取发布包声明并明确拒绝不支持的运行时；发布消费检查覆盖三系统最低版本和当前支持的 LTS 补丁版本。已有项目请先升级 Node.js；脚手架自身仍要求 Node 22.22.2、24.15.0 或 26 及以上版本，不降低其依赖所需版本。

### Patch Changes

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

- Updated dependencies:
  - @weapp-core/constants@0.3.1
  - @wevu/compiler@7.5.0
  - wevu@7.5.0

## 0.2.19

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

- Updated dependencies:
  - @weapp-core/constants@0.3.0
  - @wevu/compiler@7.4.0
  - wevu@7.4.0

## 0.2.18

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @weapp-core/constants@0.2.7
  - @wevu/compiler@7.3.0
  - wevu@7.3.0

## 0.2.17

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

- 新增职责独立的 `definePage({ name, meta })` 路由编译宏及 `wevu/router/auto-routes` 纯数据入口。路由声明要求应用内唯一的非空静态 `name`，可选 `meta` 必须是有限静态 JSON 对象；未声明该宏的页面保持未命名。该能力复用现有页面发现、分包、scope、缓存和更新链路生成稳定名称、最终路径及元信息，不恢复已移除的同名页面注册能力，也不解析 `PageMeta.route`；旧名 `definePageRoute` 不提供兼容别名。旧协议的持久化命名记录会随缓存 schema 自动失效并重新扫描，无需手动清理。

  生成声明按路由名称关联并结构化拓宽 `meta`，贯穿导航、守卫、当前路由和动态记录类型，同时保留未命名页面及无生成映射项目的兼容行为。支持小程序和现有 Web 构建目标；路由 `meta.title` 与 `meta.layout` 只是业务数据，不会改变宿主标题或页面 layout。页面元信息与布局继续由 `definePageMeta` 负责，宿主 JSON 由 `definePageJson` 负责，组件选项由 `defineOptions` 负责。

  支持全局无导入 `definePage`，以及从 `wevu/router` 导入（含别名）的宏调用，并正确处理绑定、遮蔽和支持路径中的源位置映射。宏在编译期移除，不提供运行时注册或兜底函数。自动导入声明为 Volar 和 vue-tsc 提供参数补全与类型诊断；公共路由声明类型独立于编译器 AST 依赖。外部 SFC 脚本、alias 和包导出继续保留相对模块引用。既有 `definePageMeta` 的 `layout`（包括 Vue SFC 的动态 `layout.props` 值）和其他字段保持原语义，不会进入路由 `meta`；模板表达式仍交给平台编译链路处理。仅修改路由元信息时同步更新原生增量产物与生成类型，并保留 JSON 元信息的自有键。

  自动路由关闭时清理过期声明与缓存，并串行发布并发刷新结果，避免旧产物覆盖新版本。Web 开发模式在路由元信息或页面拓扑变化时重新加载应用入口，确保活动 Router 使用新快照；Web 扫描完成后原子发布状态，刷新期间和失败后保留完整的上一份虚拟模块。页面新增和删除在 Vite 结构性 HMR 前完成扫描，并在快照发布时同步失效 Web 入口、路由模块及扫描拥有的脚本、模板和 SFC 合成样式，避免入口引用已删除页面、模板保留已删除布局、脚本遗漏新增模板和样式或 SFC 样式缓存滞留。修复 Web 页面未保留原生 `options` 查询参数导致重定向后活动页面状态丢失的问题。

- Updated dependencies:
  - @weapp-core/constants@0.2.6
  - @wevu/compiler@7.2.0
  - wevu@7.2.0

## 0.2.16

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- Updated dependencies:
  - @weapp-core/constants@0.2.5
  - @wevu/compiler@7.1.4
  - wevu@7.1.4

## 0.2.15

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @weapp-core/constants@0.2.4
  - @wevu/compiler@7.1.3
  - wevu@7.1.3

## 0.2.14

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.1.2
  - wevu@7.1.2

## 0.2.13

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @weapp-core/constants@0.2.3
  - @wevu/compiler@7.1.1
  - wevu@7.1.1

## 0.2.12

### Patch Changes

- 同步更新对 `@weapp-core/constants` 的依赖版本，使国际化、React、Web 运行时与测试工具使用本轮修复所需的公共运行时常量。

- 重构 Wevu 可选运行时能力的安装边界：编译产物会按模板元数据和应用选项显式安装所需能力，未使用 patch、模板 ref、内联事件、高频告警、作用域插槽或 layout 的小程序不再携带对应实现；公开 `wevu` 入口继续保留原有动态配置行为。

  能力分析沿用配置初始化表达式所属的词法作用域，不再被调用位置的同名局部变量误导；提取后的作用域插槽组件也会依据自身 layout host 元数据安装 layout 能力。

  按需 patch 与 diff 共用宿主提交跟踪，保证 setData 派发期间新增的 computed 变更不会丢失；清空模板 ref 绑定时会使旧异步查询失效，避免实例 `$nextTick` 读到已移除的引用。

- Updated dependencies:
  - @weapp-core/constants@0.2.2
  - @wevu/compiler@7.1.0
  - wevu@7.1.0

## 0.2.11

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.0.4
  - wevu@7.0.4

## 0.2.10

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.0.3
  - wevu@7.0.3

## 0.2.9

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.0.2
  - wevu@7.0.2

## 0.2.8

### Patch Changes

- Updated dependencies:
  - @weapp-core/constants@0.2.1
  - @wevu/compiler@7.0.1
  - wevu@7.0.1

## 0.2.7

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.0.0
  - wevu@7.0.0

## 0.2.6

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.25.1
  - wevu@6.25.1

## 0.2.5

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.25.0
  - wevu@6.25.0

## 0.2.4

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.24.0
  - wevu@6.24.0

## 0.2.3

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.23.0
  - wevu@6.23.0

## 0.2.2

### Patch Changes

- 同步共享常量依赖版本，确保相关公开包可以与 Wevu 样式运行时能力一起发布。

- 新增可脱离 Vite 使用的 `@weapp-vite/i18n` 运行时、编译器、原生 catalog 命令和微信构建 npm 入口。运行时统一采用 `createI18n()` 工厂实例和 `i18n.global`，通过 `i18n.behavior` 接入组件、通过 `i18n.page()` 适配传统 Page，并移除未发布的旧 singleton 入口；weapp-vite 同时提供 locale JSON 扫描校验、简单占位符预编译、WXS 模板改写、HMR，以及主包、普通分包和独立分包的资产与实例边界。

- Updated dependencies:
  - @weapp-core/constants@0.2.0
  - @wevu/compiler@6.22.0
  - wevu@6.22.0

## 0.2.1

### Patch Changes

- 隔离 `@wevu/test-utils` 每次组件挂载的应用上下文，避免 provide、插件、mocks 和卸载状态跨 wrapper 泄漏；同时允许测试页面目录内的普通组件，并支持自定义页面文件判定。

- 确保组件卸载生命周期抛出异常时仍会执行测试应用和插件的清理回调。

- Updated dependencies:
  - @wevu/compiler@6.21.0
  - wevu@6.21.0

## 0.2.0

### Minor Changes

- 扩展 `@wevu/test-utils`，新增 `wevuSfc()` Vitest 入口和 `mountComponent()`，可以直接导入真实 Vue SFC 并在不构建 WXML 的情况下测试 setup、props、data、computed、methods、watch、emits、provide/inject、响应式状态和生命周期。保留 `mountComposable` 兼容入口，并继续由 `@mpcore/test` 负责完整编译产物、WXML 查询和宿主交互。同步补充 Wevu 的不注册组件定义运行时入口，避免轻量测试污染小程序全局注册状态。

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.20.5
  - wevu@6.20.5
