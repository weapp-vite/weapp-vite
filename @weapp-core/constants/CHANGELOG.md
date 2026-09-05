# @weapp-core/constants

## 0.2.2

### Patch Changes

- 让 `@wevu/compiler` 在同一次模板编译中生成并消费版本化 Binding Manifest，移除 `weapp-vite` 对生成模板和脚本的 binding 二次解析；完整编译 IR 现在包含逐 dependency 更新策略和显式作用域关系，覆盖 CSS 变量样式状态、自定义指令、组件 `v-model` 修饰符及内建 template 属性等编译器生成的 mustache，且不完整清单不会启用自动 `setData.pick`。组件脚本仅注入运行时所需的精简 manifest，开发态再附加源码位置；跨文件 JSX binding 也会保留各自的源码归属和正确重映射位置。同时让 Wevu 的 `setData` 诊断按 binding id、输出路径和源码位置归因，并继续保留现有 snapshot/diff 正确性 fallback。`ScopedSlotComponentAsset` 现在直接提供必需的 `script` 与 `bindingManifest`，并移除旧的 `classStyleBindings`、`inlineExpressions`、`templateRefs` 侧通道；编译器消费者应直接 emit 新的完整资源。

- 兼容 tsdown 0.23.0 的构建配置，并同步相关开发工具包的发布说明。

## 0.2.1

### Patch Changes

- 修复首屏异步路由守卫长期等待、异常和页面卸载后的迟到回调问题。首屏导航默认改为 `eager`，页面先挂载渲染；需要在守卫完成前阻止挂载时，可通过 `initialNavigationMode: 'blocking'` 显式开启，并使用 `initialNavigationTimeout` 防止永久等待。统一清理导航状态，避免页面假死、元素缺失和实例泄漏。

## 0.2.0

### Minor Changes

- 新增可脱离 Vite 使用的 `@weapp-vite/i18n` 运行时、编译器、原生 catalog 命令和微信构建 npm 入口。运行时统一采用 `createI18n()` 工厂实例和 `i18n.global`，通过 `i18n.behavior` 接入组件、通过 `i18n.page()` 适配传统 Page，并移除未发布的旧 singleton 入口；weapp-vite 同时提供 locale JSON 扫描校验、简单占位符预编译、WXS 模板改写、HMR，以及主包、普通分包和独立分包的资产与实例边界。

### Patch Changes

- 新增 Wevu SFC CSS Modules 与 CSS 变量运行时桥接所需的共享常量。

## 0.1.17

### Patch Changes

- 🐛 **支持从相邻 JSX/TSX 模块导入并复用静态 JSX 片段、JSX 工厂函数以及经过 barrel 文件 re-export 的 JSX 片段。编译器升级到 `@vue/babel-plugin-jsx 3.0.0`，在生成 WXML 前完成静态分析，并将无法静态映射的闭包、model、slot、spread 和动态组件交给结构化 Wevu island runtime；Vue SFC 的 `<script setup lang="js|ts|jsx|tsx">` 与普通 JSX/TSX script 也进入同一编译流程。** [#791](https://github.com/weapp-vite/weapp-vite/pull/791) by @sonofmagic

- 🐛 **新增 React 19 小程序运行时、React JSX 构建配置和 React 项目模板，支持可选的 SWC React Compiler，并支持 React、Wevu 与原生组件通过动态 props、自定义事件和默认插槽双向互操作。** [#718](https://github.com/weapp-vite/weapp-vite/pull/718) by @sonofmagic

## 0.1.16

### Patch Changes

- 🐛 **微信小程序开发模式默认根据开发者工具的热重载设置自动选择 HMR 运行时，并在启动时显示当前模式与切换方法；同时确保 Web API 网络默认值在分包和共享 chunk 的多份运行时实例之间保持一致，并避免截图协议超时后在同一 DevTools 连接上继续叠加请求。** [#778](https://github.com/weapp-vite/weapp-vite/pull/778) by @sonofmagic

## 0.1.15

### Patch Changes

- 🐛 **新增 uview-plus 3.8.86 全组件解析器与三端兼容示例，并完善 uni-app SFC 的条件编译、sidecar、Web 子组件解析、样式预处理和 headless 宿主 API 兼容。** [#758](https://github.com/weapp-vite/weapp-vite/pull/758) by @sonofmagic

- 🐛 **新增实验性的 uni-app Vue SFC 组件库兼容层与 `WotUiResolver()`，支持显式白名单依赖的条件编译、外部组件图、样式资源和双端注册，并补齐 Wot UI 2.2.0 全部 99 个公开组件在微信小程序、Web 与 headless 运行时所需的编译和运行时语义。外部组件产物使用微信允许的稳定目录名，避免组件文件因命中双下划线保留目录规则而被开发者工具忽略。** [#757](https://github.com/weapp-vite/weapp-vite/pull/757) by @sonofmagic

## 0.1.14

### Patch Changes

- 🐛 **使用 Vite/Rolldown 真实模块图追踪静态与动态 import、别名、npm、外部链接源码以及小程序 template、style、JSON、WXS、layout 和 `usingComponents` sidecar 依赖，修复增量构建中 importer 传播不完整、无关入口被重复标脏及 sidecar 新增删除失效不稳定的问题。** [#735](https://github.com/weapp-vite/weapp-vite/pull/735) by @sonofmagic

- 🐛 **引入声明式 runtime provider 契约，让原生小程序、wevu Vue SFC 与 Web 构建通过稳定虚拟入口选择各自运行时，并在入口缺失或契约版本不匹配时给出明确诊断。** [#736](https://github.com/weapp-vite/weapp-vite/pull/736) by @sonofmagic

## 0.1.13

### Patch Changes

- 🐛 **新增微信开发者工具实验性状态保持热更新，可在安全的 JavaScript 与 Vue 更新中保留原生 Page、原生 Component 和 wevu 页面状态，并在不兼容更新时自动回退完整重载。** [#717](https://github.com/weapp-vite/weapp-vite/pull/717) by @sonofmagic

## 0.1.12

### Patch Changes

- 🐛 **优化 Vue SFC 具名插槽 fallback wrapper 的产物稳定性：微信平台内部 `virtualHost` wrapper 改为固定输出到根级内部组件路径，并优先通过 `app.json` 全局注册，减少页面和组件 JSON 的重复变更；同时允许显式配置 `slot-wrapper="block"`，默认策略仍保持更稳妥的内部 wrapper。** [#636](https://github.com/weapp-vite/weapp-vite/pull/636) by @sonofmagic

## 0.1.11

### Patch Changes

- 🐛 **微信平台普通具名插槽转发 `<slot />` 时，默认改用内部 `virtualHost` 组件作为 fallback wrapper，减少旧版 `view` wrapper 对布局的影响；同时新增 `weapp.vue.template.slotFallbackWrapperStrategy: 'view'` 作为回退选项，显式 `slotFallbackWrapper` 配置仍保持原有行为。** [#631](https://github.com/weapp-vite/weapp-vite/pull/631) by @sonofmagic

## 0.1.10

### Patch Changes

- 🐛 **调整 `useTemplateRef()` 的模板 ref 元数据，仅保留基于 class 的 `selector` 作为节点定位入口，不再为普通模板 ref 自动生成或暴露额外 `id`，并同步收敛共享常量导出。** [#620](https://github.com/weapp-vite/weapp-vite/pull/620) by @sonofmagic

## 0.1.9

### Patch Changes

- 🐛 **修复 `<script setup>` 中 props 解构别名与同名 setup 绑定混用时的运行时和编译期分层问题，保证 props 别名、setup 本地状态与原始 props 可以分别更新，并让 issue #600 的页面在 IDE 与生成产物中保持一致。同时让 class/style/v-show 运行时 fallback 在首帧对象尚未就绪时静默回退，避免 issue #322 场景在 IDE 控制台输出模板表达式异常。** [#606](https://github.com/weapp-vite/weapp-vite/pull/606) by @sonofmagic

## 0.1.8

### Patch Changes

- 🐛 **补发共享常量包，并同步提升所有公开依赖包版本，确保新增的 wevu 函数 props 运行时常量会随用户更新一起解析到 npm 最新产物。** [`362bbd3`](https://github.com/weapp-vite/weapp-vite/commit/362bbd3e3bbed438746fe4db00602204da8c7ec2) by @sonofmagic

## 0.1.7

### Patch Changes

- 🐛 **修复 `scopedSlotsCompiler: 'augmented'` 下默认插槽中的运行时绑定表达式无法调用宿主 `setup` 方法的问题。增强 scoped slot 生成的 `__wv_bind_*` 现在会从宿主 proxy 读取函数和值，WXML 仍保留序列化快照用于模板渲染。** [#573](https://github.com/weapp-vite/weapp-vite/pull/573) by @sonofmagic
  - 同时修复带有 scoped slot 内部 `properties` 的 Vue 组件会丢失业务 `props` 的问题，避免 `KpiBoard` 这类组件在微信开发者工具中拿不到 `items` 后渲染为空。

## 0.1.6

### Patch Changes

- 🐛 **支持在 `src/app.vue` 中编写应用级 `<template>`，并在微信小程序下将其作为内部 app shell 组件包裹页面输出，避免生成无效的 `app.wxml`。同时在 app shell 或页面 layout 缺少默认 `<slot />` 时抛出明确错误，避免页面内容被静默丢弃。** [#564](https://github.com/weapp-vite/weapp-vite/pull/564) by @sonofmagic

- 🐛 **将当前发布分支的运行时代码回滚到 6.16.7 稳定基线，仅保留 issue #553、#554、#555 与 #563 的修复，避免 6.16.8 中 scoped slot 运行时同步改动继续影响页面运行。** [#568](https://github.com/weapp-vite/weapp-vite/pull/568) by @sonofmagic

## 0.1.5

### Patch Changes

- 🐛 **修复 `scopedSlotsCompiler: 'augmented'` 下插槽内容中的 `__wv_bind_*` 计算属性无法调用宿主 `setup` 方法的问题。增强 scoped slot 运行时现在会保留宿主 proxy 引用，编译出的 JS 计算表达式优先读取该 proxy，从而让 `func(text)` 这类插槽表达式可以正常得到 `987654321`，同时仍保留序列化快照用于 WXML 数据渲染。** [#560](https://github.com/weapp-vite/weapp-vite/pull/560) by @sonofmagic

- 🐛 **修复增强 scoped slot 在微信开发者工具真实运行时下的属性同步问题，避免生成非法 WXML 表达式、非法 data path descriptor、属性覆盖以及向顶层 data 写入 undefined 的 warning。scoped slot 运行时现在会从宿主组件同步安全的小写 slot owner / props 数据，并保留 IDE e2e 覆盖。** [#562](https://github.com/weapp-vite/weapp-vite/pull/562) by @sonofmagic

## 0.1.4

### Patch Changes

- 🐛 **补充 `useSlots()` 的小程序端最小可用语义：编译器会基于组件来源为 wevu/Vue SFC 组件调用注入内部 `vue-slots` 元数据，支持 `<my-card>` 这类 kebab-case 写法，运行时据此恢复可枚举的 slots 对象，让 `Object.keys(useSlots())`、`useSlots().header` 与模板中的 `$slots.header` 可以判断普通插槽是否存在。没有编译期 slot 元数据时仍返回冻结的空 slots 对象；`<template #slot v-if="expr">` 会同步把条件映射到 slot 元数据和原生 fallback 内容上；TDesign 等原生小程序组件仍避免注入该内部属性。** [`1b4b28c`](https://github.com/weapp-vite/weapp-vite/commit/1b4b28c38de0f118f6f2423fdffa77cce053f981) by @sonofmagic

## 0.1.3

### Patch Changes

- 🐛 **修复 wevu provide/inject 在小程序运行时只能依赖 app 级 provide 的问题，对齐 Vue 3 的 app、layout、page、组件祖先链注入语义，并补充深层组件注入覆盖。** [#511](https://github.com/weapp-vite/weapp-vite/pull/511) by @sonofmagic

## 0.1.2

### Patch Changes

- 🐛 **为 `import.meta.env` 调试稳定性补充共享缓存 key 常量，供 `weapp-vite` 在页面与组件产物中复用同一份 env 表达式，减少调试输出行号漂移。** [#495](https://github.com/weapp-vite/weapp-vite/pull/495) by @sonofmagic

## 0.1.1

### Patch Changes

- 🐛 **修复 `weapp-vite` 等公开包对 `@weapp-core/constants` 发布依赖被锁定为精确版本的问题，并补充 constants 包变更必须带 changeset 的发布校验，避免共享常量新增导出后用户安装到旧版 constants 产物时出现运行时报错。** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446) by @sonofmagic

## 0.1.0

### Minor Changes

- ✨ **新增 `@weapp-core/constants` 包，用于沉淀可同时被 Node 侧构建流程、小程序运行时代码以及测试复用的共享常量；同时将请求全局对象注入与 app prelude 相关的内部私有命名迁移到该包统一管理，缩短 guard key、共享字段和 helper 标识符，减少最终构建产物中的冗长内部字段名，同时保持原有运行时行为与兼容性不变。** [`db65791`](https://github.com/weapp-vite/weapp-vite/commit/db65791b4d042b3090d3f4eecae30d2cc6ca7da5) by @sonofmagic
