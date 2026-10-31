# @wevu/web-apis

## 1.4.1

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
  - @weapp-core/api@0.4.1
  - @weapp-core/constants@0.5.1
  - @wevu/api@0.4.1

## 1.4.0

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

- feat: 支持在微信小程序中使用 Fetch 响应流和 EventSource。

  `@wevu/web-apis` 与 `wevu` 支持增量 UTF-8 解码、标准流消费和取消，以及 SSE 事件解析与重连，可复用 Web 的 Fetch 响应流和 `EventSource` 写法。

  `weapp-vite` 在第三方模块执行前注入所需构造器，避免依赖在初始化时找不到相关 API。

  宿主缺少早期真实 HTTP 状态码或分块 API 时，会明确报告能力限制；普通缓冲请求和现有 Wevu 入口继续可用。

### Patch Changes

- fix(web): 保留 data-* 完整表达式的原始值类型。

  编译模板与旧字符串模板的事件、组件事件、选择器和交叉观察器保留数字、布尔值、对象及数组，修复这些值被字符串化的问题；DOM 属性仍可按字符串查询，更新、移除和重新连接时读取保持正确。

  HTML 属性名按 DOM 的 ASCII 大小写规则归一，避免 `data-itemName` 与 `data-item-name` 串值；SVG/XML 保留大小写敏感语义。

  模拟器的交叉观察器回调同样保留 dataset 原始值类型，与事件和选择器读取保持一致。

- Updated dependencies:
  - @weapp-core/api@0.4.0
  - @weapp-core/constants@0.5.0
  - @wevu/api@0.4.0

## 1.3.6

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

- fix(web-apis): 修复 URL 查询参数包含不完整百分号转义或非法 UTF-8 字节时抛出异常，保留有效文本、替换字符和 searchParams 同步行为。

- fix: 修复 JSX/TSX 模板热更新绕过注册能力检查、导致页面数据与实际渲染不一致的问题。共享模板、内联事件、计算绑定和动态岛注册语义变化时切换为完整重载，纯方法脚本更新继续保留状态；跨文件静态展开同时沿用当前构建的冻结源码，避免读取后续保存的内容。模拟器增加显式编译模板注册与提交能力，避免仅修改磁盘文件就被误判为宿主模板已更新。

  修复 Wevu、Tailwind CSS 与 TDesign 模板的 npm 文件筛选，保留组件入口实际引用的 `type.js`、配置状态管理和语言包等完整传递依赖，避免 classic 完整发布存在悬空模块依赖；零售模板与示例使用显式媒体组件入口，并检查产物路径完整；脚手架同步提供修正后的模板。

  React 静态模板和 dynamic 模板更新目前均缺少经真实微信宿主验证的状态保留能力，统一按编译结果明确切换为 classic；解析错误与编译错误继续报告。请求的 HMR 模式配置保持原值，后续修改沿用本次开发会话的 classic 决策。

  React 自动渲染选择仅对编译器明确声明不支持的合法结构退回 dynamic；语法、内部编译和原生 bridge 错误保持失败并保留上一份完整模板，不再被包装成成功回退。

  原生 Vue 的 Patch 与 Noop 交付统一根据冻结源码判断模板和样式变化，避免 Tailwind 内容通知覆盖样式分类后继续发布旧 CSS；纯脚本修改仍保留无需视觉快照编译的路径。

  classic 开发发布以完整产物内容更新 App 入口，让微信开发者工具自动完整重载，避免后续 TSX 混合模板和脚本保存出现新事件逻辑配旧模板；保持用户原有热重载开关，stateful 支持的更新继续保留状态。

- Updated dependencies:
  - @weapp-core/api@0.3.9
  - @weapp-core/constants@0.4.0
  - @wevu/api@0.3.9

## 1.3.5

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
  - @wevu/api@0.3.8

## 1.3.4

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
  - @wevu/api@0.3.7

## 1.3.3

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- 根据六类小程序与 Web 构建目标自动裁剪 Wevu 宿主适配，移除未使用的首航路由与 JSX island 实现，并避免 SFC 子组件注册重新引入完整兼容工厂。保留动态公开 API 和跨平台 adapter 行为，补充七端体积门禁与真实消费回归，同步脚手架随包指引。

- Updated dependencies:
  - @weapp-core/constants@0.2.7
  - @wevu/api@0.3.6

## 1.3.2

### Patch Changes

- 修复抖音等小程序模块缺少 globalThis 或仅提供顶层宿主绑定时的 router 初始化与微任务调度，统一宿主解析并保留独立分包的 router 隔离；同时修复支付宝页面在 setup 和后续生命周期中丢失路由 query 的问题。

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
  - @wevu/api@0.3.5

## 1.3.1

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
  - @wevu/api@0.3.4

## 1.3.0

### Minor Changes

- 补齐 Request/Response 的字节、JSON 与 Blob 读取接口，修正 Body 单次消费、Blob UTF-8 长度与二进制快照，新增 Blob 切片并完善 Headers 回调契约。非空 body 读取或发送后再次读取、克隆会报错，需要重复读取时请在消费前调用 clone。

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @weapp-core/constants@0.2.4
  - @wevu/api@0.3.3

## 1.2.42

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @weapp-core/constants@0.2.3
  - @wevu/api@0.3.2

## 1.2.41

### Patch Changes

- 新增适用于静态 WXML 数据绑定的 `useAsyncDerivation()`，统一首次加载、保留旧值刷新、错误、竞态取消与作用域销毁状态，并让根入口导入稳定路由到独立响应式产物。

  终态观察者抛错时仍然结算所有 refresh 等待者，并把 Promise 的 then 访问与接管隔离在响应式依赖收集之外；带有自定义 then 访问器的原生 Promise 同样遵循异步错误契约。

  异步派生状态按每个 `status` 字面量独立建模，使条件分支和 `Extract` 等类型工具都能准确收窄状态对应的值。

- 同步更新对 `@weapp-core/constants` 的依赖版本，使国际化、React、Web 运行时与测试工具使用本轮修复所需的公共运行时常量。

- 重构 Wevu 可选运行时能力的安装边界：编译产物会按模板元数据和应用选项显式安装所需能力，未使用 patch、模板 ref、内联事件、高频告警、作用域插槽或 layout 的小程序不再携带对应实现；公开 `wevu` 入口继续保留原有动态配置行为。

  能力分析沿用配置初始化表达式所属的词法作用域，不再被调用位置的同名局部变量误导；提取后的作用域插槽组件也会依据自身 layout host 元数据安装 layout 能力。

  按需 patch 与 diff 共用宿主提交跟踪，保证 setData 派发期间新增的 computed 变更不会丢失；清空模板 ref 绑定时会使旧异步查询失效，避免实例 `$nextTick` 读到已移除的引用。

- Updated dependencies:
  - @weapp-core/constants@0.2.2
  - @wevu/api@0.3.1

## 1.2.40

### Patch Changes

- 修复 Wevu 首屏异步导航对宿主 `queueMicrotask` 和现代内建的隐式依赖，收紧 headless simulator 的 AppService 全局边界，并新增仅作用于小程序运行时代码的 ESLint API 门禁、模板配置与真实 DevTools 验证规范。

## 1.2.39

### Patch Changes

- Updated dependencies:
  - @weapp-core/constants@0.2.1

## 1.2.38

### Patch Changes

- Updated dependencies:
  - @wevu/api@0.3.0

## 1.2.37

### Patch Changes

- Updated dependencies:
  - @wevu/api@0.2.18

## 1.2.36

### Patch Changes

- Updated dependencies:
  - @wevu/api@0.2.17

## 1.2.35

### Patch Changes

- 同步共享常量依赖版本，确保相关公开包可以与 Wevu 样式运行时能力一起发布。

- 新增可脱离 Vite 使用的 `@weapp-vite/i18n` 运行时、编译器、原生 catalog 命令和微信构建 npm 入口。运行时统一采用 `createI18n()` 工厂实例和 `i18n.global`，通过 `i18n.behavior` 接入组件、通过 `i18n.page()` 适配传统 Page，并移除未发布的旧 singleton 入口；weapp-vite 同时提供 locale JSON 扫描校验、简单占位符预编译、WXS 模板改写、HMR，以及主包、普通分包和独立分包的资产与实例边界。

- Updated dependencies:
  - @weapp-core/constants@0.2.0

## 1.2.34

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/api@0.2.16`

## 1.2.33

### Patch Changes

- 📦 **Dependencies** [`e5a8f23`](https://github.com/weapp-vite/weapp-vite/commit/e5a8f23e9bdceadaaebc0c9d747303ba221b42b8)
  → `@weapp-core/constants@0.1.17`

## 1.2.32

### Patch Changes

- 📦 **Dependencies** [`8d7c0a2`](https://github.com/weapp-vite/weapp-vite/commit/8d7c0a292cd98462ba127f7ab4fd5077a09b54de)
  → `@wevu/api@0.2.15`

## 1.2.31

### Patch Changes

- 🐛 **微信小程序开发模式默认根据开发者工具的热重载设置自动选择 HMR 运行时，并在启动时显示当前模式与切换方法；同时确保 Web API 网络默认值在分包和共享 chunk 的多份运行时实例之间保持一致，并避免截图协议超时后在同一 DevTools 连接上继续叠加请求。** [#778](https://github.com/weapp-vite/weapp-vite/pull/778) by @sonofmagic
- 📦 **Dependencies** [`b055929`](https://github.com/weapp-vite/weapp-vite/commit/b055929f8c18a2a9be800eff88f8f7806a9a4f46)
  → `@weapp-core/constants@0.1.16`

## 1.2.30

### Patch Changes

- 📦 **Dependencies** [`c7d8514`](https://github.com/weapp-vite/weapp-vite/commit/c7d85143aeb5edaaf5d1902a8bd3d5fe09ef570e)
  → `@wevu/api@0.2.14`

## 1.2.29

### Patch Changes

- 🐛 **修复真实微信开发者工具自动化中的会话复用、页面重启、日志收集与截图清理稳定性问题，避免 `forwardConsole` 重复连接现有会话，并降低完整 IDE E2E 在组件库和 GitHub issue 回归场景中的重复启动成本。** [#770](https://github.com/weapp-vite/weapp-vite/pull/770) by @sonofmagic

- 🐛 **修复 Web API polyfill 对无填充 Base64、可迭代 Headers、请求中止竞态及 URL/XHR 宿主回退的兼容行为，并补齐完整能力矩阵回归。** [#760](https://github.com/weapp-vite/weapp-vite/pull/760) by @sonofmagic
- 📦 **Dependencies** [`878073f`](https://github.com/weapp-vite/weapp-vite/commit/878073f8819a21f7e6baa96d13cf3f7e552d2158)
  → `@weapp-core/constants@0.1.15`, `@wevu/api@0.2.13`

## 1.2.28

### Patch Changes

- 📦 **Dependencies** [`5c251fa`](https://github.com/weapp-vite/weapp-vite/commit/5c251fa06bbf2818601959aace2d402f9a1dffc7)
  → `@weapp-core/constants@0.1.14`, `@wevu/api@0.2.12`

## 1.2.27

### Patch Changes

- 📦 **Dependencies** [`511dd9f`](https://github.com/weapp-vite/weapp-vite/commit/511dd9f9eae061d68342c21175d792b9cc44c0b5)
  → `@weapp-core/constants@0.1.13`

## 1.2.26

### Patch Changes

- 🐛 **修复 Web Runtime URL polyfill 解析自定义协议根路径时重复插入路径分隔符的问题，并让 installer 与 chunk 局部绑定统一校验宿主 URL 的相对路径语义，使 `URL` 构造器和 `URL.parse()` 的结果与 Web 标准行为保持一致。** [#715](https://github.com/weapp-vite/weapp-vite/pull/715) by @sonofmagic

## 1.2.25

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/api@0.2.11`

## 1.2.24

### Patch Changes

- 📦 **Dependencies** [`2aad19f`](https://github.com/weapp-vite/weapp-vite/commit/2aad19fe79a30cefd6feced87fedda88af932d84)
  → `@wevu/api@0.2.10`

## 1.2.23

### Patch Changes

- 🐛 **修复小程序宿主返回的 ArrayBuffer 放入 Blob/File 后被 FormData multipart 序列化为 `[object ArrayBuffer]` 的问题，并补齐 ArrayBuffer、ArrayBufferView、Blob、File 与 Blob-like 对象作为 fetch body 时的二进制保真处理。** [#686](https://github.com/weapp-vite/weapp-vite/pull/686) by @sonofmagic

## 1.2.22

### Patch Changes

- 🐛 **修复 `RequestPolyfill` 携带 `FormData` 请求体时被字符串化的问题，确保 `fetch(new Request(...))` 与直接传入 `FormData` 一样生成 multipart 请求体和对应请求头。** [#685](https://github.com/weapp-vite/weapp-vite/pull/685) by @sonofmagic

## 1.2.21

### Patch Changes

- 🐛 **补齐 Web Runtime 的 File 兼容层，并让 FormData 的 append/set 支持文件名参数；weapp-vite 的请求全局被动绑定同步提供 File，避免第三方请求库在模块初始化阶段读取自由变量时缺少构造器。** [#678](https://github.com/weapp-vite/weapp-vite/pull/678) by @sonofmagic

- 🐛 **修复 fetch 通过小程序 request 桥发送 FormData 时不支持 multipart body 的问题，支持 Blob/File 文件字段上传并保留文件名与内容类型。** [#680](https://github.com/weapp-vite/weapp-vite/pull/680) by @sonofmagic

## 1.2.20

### Patch Changes

- 🐛 **补齐 Web Runtime 兼容层中的低成本 Web API 辅助能力：`URL.parse()`、`URL.canParse()`、`URLSearchParams.size`、`URLSearchParams.sort()`、`Headers.getSetCookie()`、`Response.json()` 与 `Response.error()` 现在可以通过 polyfill 和全局安装链路稳定使用。** [#660](https://github.com/weapp-vite/weapp-vite/pull/660) by @sonofmagic

## 1.2.19

### Patch Changes

- 📦 **Dependencies** [`6e5604f`](https://github.com/weapp-vite/weapp-vite/commit/6e5604fd86e11a6921b5eca4722d145dab1c8a1d)
  → `@weapp-core/constants@0.1.12`

## 1.2.18

### Patch Changes

- 📦 **Dependencies** [`578fed1`](https://github.com/weapp-vite/weapp-vite/commit/578fed1b2a1f140eaf6bda433405a97cce49c20d)
  → `@weapp-core/constants@0.1.11`

## 1.2.17

### Patch Changes

- 📦 **Dependencies** [`492e5ee`](https://github.com/weapp-vite/weapp-vite/commit/492e5ee9465456992d6ff248077436f8a4dba710)
  → `@weapp-core/constants@0.1.10`

## 1.2.16

### Patch Changes

- 📦 **Dependencies** [`52fc0f7`](https://github.com/weapp-vite/weapp-vite/commit/52fc0f7ea021ac89ea43e58f939d99e9683e39e3)
  → `@weapp-core/constants@0.1.9`

## 1.2.15

### Patch Changes

- 🐛 **统一公开包的 workspace 内部依赖发布策略，改为发布时写入精确版本，并补充仓库守卫防止内部依赖再次回退到宽松 range。** [`56da329`](https://github.com/weapp-vite/weapp-vite/commit/56da329a2d6eb582323b7146b480f153f2183d2e) by @sonofmagic

## 1.2.14

### Patch Changes

- 🐛 **补发共享常量包，并同步提升所有公开依赖包版本，确保新增的 wevu 函数 props 运行时常量会随用户更新一起解析到 npm 最新产物。** [`362bbd3`](https://github.com/weapp-vite/weapp-vite/commit/362bbd3e3bbed438746fe4db00602204da8c7ec2) by @sonofmagic
- 📦 **Dependencies** [`362bbd3`](https://github.com/weapp-vite/weapp-vite/commit/362bbd3e3bbed438746fe4db00602204da8c7ec2)
  → `@weapp-core/constants@0.1.8`

## 1.2.13

### Patch Changes

- 📦 **Dependencies** [`74978d8`](https://github.com/weapp-vite/weapp-vite/commit/74978d89dfc25439803b7003119ee57b8fadc27f)
  → `@wevu/api@0.2.9`

## 1.2.12

### Patch Changes

- 🐛 **将会进入小程序运行时、编译链路和回归示例的 `Object.hasOwn()` 调用改为兼容的 `Object.prototype.hasOwnProperty.call(...)` 封装，并补充 ESLint 限制，避免 Rolldown 无法降级的运行时内建 API 进入小程序产物。** [`43bcefc`](https://github.com/weapp-vite/weapp-vite/commit/43bcefc22656df15897ff5cb960cdbe3f106d04b) by @sonofmagic
- 📦 **Dependencies** [`6703f0b`](https://github.com/weapp-vite/weapp-vite/commit/6703f0b283cf956b6f61d6eed8e3530f5c5de5eb)
  → `@wevu/api@0.2.8`

## 1.2.11

### Patch Changes

- 📦 **Dependencies** [`1d4d1c0`](https://github.com/weapp-vite/weapp-vite/commit/1d4d1c01a4f3848e3087864613a6bf42d68f7803)
  → `@wevu/api@0.2.7`

## 1.2.10

### Patch Changes

- 📦 **Dependencies** [`2a9ea57`](https://github.com/weapp-vite/weapp-vite/commit/2a9ea57748425265c35533646bdc0c3fa70c440f)
  → `@wevu/api@0.2.6`, `@weapp-core/constants@0.1.2`

## 1.2.9

### Patch Changes

- 🐛 **修复小程序 Web Runtime 的网络兼容层不支持把宿主扩展参数稳定传到底层请求与 Socket 能力的问题。现在除了 `fetch(url, { miniProgram: { ... } })` / `fetch(url, { miniprogram: { ... } })` 和 `axios` 的 `fetchOptions.miniProgram` 之外，还新增了运行时级默认配置能力，可统一作用于 `fetch`、`XMLHttpRequest`、`WebSocket` 以及依赖这些全局对象的 `graphql-request`、`axios(xhr)`、`socket.io-client` 等库。`weapp-vite` 现在也支持直接在 `vite.config.ts` 的 `weapp.appPrelude.webRuntime.networkDefaults` 或 `weapp.injectWebRuntimeGlobals.networkDefaults` 中声明这些默认参数，让 app prelude、bundle runtime 与源码注入链路都能在安装 Web Runtime 时同步下发。显式请求参数会覆盖默认配置，同时仍保持 `url`、`method`、`header`、`data`、`responseType` 等标准字段由兼容层接管，不允许被宿主扩展项破坏。** [`c9c1da1`](https://github.com/weapp-vite/weapp-vite/commit/c9c1da16e3c59a43b6b0fd42ac7f078174447f5f) by @sonofmagic
- 📦 **Dependencies** [`6587638`](https://github.com/weapp-vite/weapp-vite/commit/6587638d0708f63455a01a026eca789fd45387cd)
  → `@wevu/api@0.2.5`

## 1.2.8

### Patch Changes

- 📦 **Dependencies** [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3)
  → `@wevu/api@0.2.4`

## 1.2.7

### Patch Changes

- 🐛 **修复 `@wevu/web-apis` 中 `URLPolyfill` 与 `RequestPolyfill` / `fetch` 直接组合时的兼容问题，统一 `URL`、`TextEncoder`、`TextDecoder` 构造器解析，并收敛 `Request` / `Response` 的 body 内部状态暴露，同时补充 `TextEncoderPolyfill` 与 `TextDecoderPolyfill` 的根入口导出。** [#460](https://github.com/weapp-vite/weapp-vite/pull/460) by @sonofmagic

## 1.2.6

### Patch Changes

- 🐛 **修复 `weapp-vite` 等公开包对 `@weapp-core/constants` 发布依赖被锁定为精确版本的问题，并补充 constants 包变更必须带 changeset 的发布校验，避免共享常量新增导出后用户安装到旧版 constants 产物时出现运行时报错。** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446) by @sonofmagic
- 📦 **Dependencies** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446)
  → `@weapp-core/constants@0.1.1`

## 1.2.5

### Patch Changes

- 🐛 **为 `weapp-vite` / `@wevu/web-apis` 的 Web Runtime 按需注入链路补齐下一批高频全局能力：新增 `atob`、`btoa`、`queueMicrotask`、`performance.now`、`crypto.getRandomValues`、`Event`、`CustomEvent` 的 runtime installer、局部绑定和自动目标解析，并补充 `github-issues` 中 issue #448 的构建回归页，确保这些能力在真实小程序构建产物里可以按需注入到页面作用域。** [#452](https://github.com/weapp-vite/weapp-vite/pull/452) by @sonofmagic

## 1.2.4

### Patch Changes

- 🐛 **修复小程序请求运行时按需注入缺失 `TextDecoder` 与 `TextEncoder` 的问题。现在 `fetch`、`Request`、`Response`、`XMLHttpRequest`、`WebSocket` 等链路会自动补齐文本编解码构造器，并在运行时 installer、局部自由变量绑定和最终 bundle 注入阶段保持一致，避免真实宿主里出现 `TextDecoder is not defined` 一类初始化错误；同时把共享 runtime marker 常量收敛到 `@weapp-core/constants`，统一跨包实现与测试约束。** [`b8b4b0e`](https://github.com/weapp-vite/weapp-vite/commit/b8b4b0e6aa0f878de557fa1a93f583f4df8bb232) by @sonofmagic

- 🐛 **将按需注入能力的主命名从偏窄的 request 语义收敛为更准确的 Web Runtime 语义。现在推荐使用 `weapp.appPrelude.webRuntime`、`weapp.injectWebRuntimeGlobals` 与 `installWebRuntimeGlobals()`，并保留 `requestRuntime`、`injectRequestGlobals`、`installRequestGlobals()` 作为兼容别名与过渡提示；同时同步更新类型导出、示例项目与文档，避免新增 `TextEncoder`、`TextDecoder`、`WebSocket`、`URL` 等能力后继续沿用过时命名。** [`a4b33b0`](https://github.com/weapp-vite/weapp-vite/commit/a4b33b089b0487120c1cf999a9fdb17efb5b9055) by @sonofmagic

## 1.2.3

### Patch Changes

- 🐛 **修复小程序请求全局安装在原生运行时中的兼容性问题：现在会跳过 `null` 宿主、对拒绝写入的宿主安全降级，并稳定同步实际全局注册表，避免 `installRequestGlobals()` / `injectRequestGlobals` 场景下出现 `Cannot set property 'fetch' of undefined`，同时提升 IDE e2e 中共享 DevTools 会话切页的稳定性。** [`25fb6e7`](https://github.com/weapp-vite/weapp-vite/commit/25fb6e78611b6d58990576d61383636122248f60) by @sonofmagic
- 📦 **Dependencies** [`db65791`](https://github.com/weapp-vite/weapp-vite/commit/db65791b4d042b3090d3f4eecae30d2cc6ca7da5)
  → `@weapp-core/constants@0.1.0`

## 1.2.2

### Patch Changes

- 🐛 **修复多个发布包在严格 TypeScript 校验下的类型问题，补齐 `tsd` 类型回归测试，并同步收敛 `wevu`、`@weapp-vite/mcp`、`@wevu/web-apis` 与 `create-weapp-vite` 的类型契约，减少后续重构时的类型回退风险。** [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75) by @sonofmagic

## 1.2.1

### Patch Changes

- 🐛 **修复手动调用 `installRequestGlobals()` / `installAbortGlobals()` 时的请求全局兼容链路。现在 `weapp-vite` 会为这类显式安装场景补充被动本地绑定，`@wevu/web-apis` 也会同步更新内部实际全局映射，使同模块里的 `fetch`、`URL`、`AbortController` 等自由变量在小程序产物中能够正确读取到已安装的 polyfill，而不会再出现手动安装后仍为 `undefined` 的情况。** [`feb5eaf`](https://github.com/weapp-vite/weapp-vite/commit/feb5eaf2dbbb232359b59fb4625bf626e047e415) by @sonofmagic

- 🐛 **修复小程序运行时中 `socket.io-client` 的 `polling` 与 `websocket` 两种传输模式兼容性。现在构建产物会提前把请求相关全局对象的惰性占位符暴露到 `globalThis`，并在真实运行时安装阶段正确替换这些占位符，避免第三方库在模块初始化阶段读取 `WebSocket` 等全局对象时失效或形成递归调用。** [`d89b50b`](https://github.com/weapp-vite/weapp-vite/commit/d89b50b573e461b91bf92e6febd279b72da95fed) by @sonofmagic

## 1.2.0

### Minor Changes

- ✨ **为 `@wevu/web-apis` 新增基于小程序 `SocketTask` 的 `WebSocket` 兼容层，并将其接入 `installRequestGlobals` 默认注入目标。现在可以在小程序运行时直接使用 `new WebSocket()`、`send()`、`close()`、`onopen`、`onmessage` 等浏览器风格接口，同时保留对 `@wevu/api` 底层连接能力的复用。** [`bde6c23`](https://github.com/weapp-vite/weapp-vite/commit/bde6c239f5a31980a6db1b1500cd257ded6bba4c) by @sonofmagic

## 1.1.1

### Patch Changes

- 📦 **Dependencies** [`e001dfe`](https://github.com/weapp-vite/weapp-vite/commit/e001dfe7f2ccc6db95668af627a9b7cfc6d4b6ad)
  → `@wevu/api@0.2.3`

## 1.1.0

### Minor Changes

- ✨ **新增 `@wevu/web-apis` 包，用于承载小程序运行时中的 Web API 垫片与全局注入能力。`weapp-vite` 现在直接复用该包提供 `weapp-vite/web-apis` 入口，后续可以在独立包中持续扩展 `fetch`、`URL`、`Blob`、`FormData` 以及更多 Web 对象的维护与注入逻辑。** [`1b5a4f8`](https://github.com/weapp-vite/weapp-vite/commit/1b5a4f81e4035d00ce430214b9365ea0a7c2de32) by @sonofmagic
