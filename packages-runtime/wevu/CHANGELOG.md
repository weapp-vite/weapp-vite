# wevu

## 6.15.13

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.15.13`

## 6.15.12

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.15.12`

## 6.15.11

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.15.11`

## 6.15.10

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.15.10`

## 6.15.9

### Patch Changes

- 🐛 **让 `wevu` 新增正式的 `wevu/web-apis` 子路径导出，用来暴露 `@wevu/web-apis` 的公开能力，方便直接从 `wevu` 侧获取 `Headers` / `Request` / `Response` 兼容层、`WebSocket` 兼容层以及 `installWebRuntimeGlobals`、`setMiniProgramNetworkDefaults` 等 Web Runtime 安装函数。同时 `wevu/fetch` 会收敛回只负责本地 `fetch` 语义，不再顺带混入整套 `web-apis` 导出，整体出口结构会更清晰。现在 `wevu/fetch` 会直接委托给 `@wevu/web-apis/fetch` 的共享实现，并持续支持 `miniProgram` / `miniprogram` 请求参数和运行时默认网络配置，确保通过 `wevu/fetch` 发出的请求与 Web Runtime 注入链路在宿主扩展参数和响应语义上保持一致。** [`3b542df`](https://github.com/weapp-vite/weapp-vite/commit/3b542df8b9ba4b8c56b2ed60298da8bbf557e0ed) by @sonofmagic
- 📦 **Dependencies** [`c9c1da1`](https://github.com/weapp-vite/weapp-vite/commit/c9c1da16e3c59a43b6b0fd42ac7f078174447f5f)
  → `@wevu/web-apis@1.2.9`, `@wevu/api@0.2.5`, `@wevu/compiler@6.15.9`

## 6.15.8

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.15.8`

## 6.15.7

### Patch Changes

- 🐛 **继续收敛多平台接入链路：统一默认平台与微信兼容别名导出，补充宿主 source registry/contract 类型入口，并让抖音 typings 元数据、tsconfig 生成与脚手架模板依赖池保持一致。** [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3) by @sonofmagic

- 🐛 **补充 wevu 抖音宿主类型的 `Douyin*` 语义主名，并保留 `Tt*` 兼容别名，减少后续多平台宿主扩展继续依赖 `tt` 命名的耦合。** [`3ef767b`](https://github.com/weapp-vite/weapp-vite/commit/3ef767b513ab6410fb991f808a7e5b9b524562e4) by @sonofmagic

- 🐛 **继续收敛 wevu 的宿主类型源命名，拆分平台语义 source name、运行时别名 source name 和联合兼容 registry，方便支付宝、抖音等平台后续沿统一命名扩展。** [`b98d165`](https://github.com/weapp-vite/weapp-vite/commit/b98d165d0b612022e3f62e9083dd849f29687ce3) by @sonofmagic

- 🐛 **继续收敛多平台小程序适配的共享 contract 与宿主中立命名。`@weapp-core/shared` 现在提供更安全的运行时根入口与独立的 Node 子入口，统一平台 registry、宿主全局对象、模板指令前缀、路由与 capability 描述，避免小程序环境误入 Node-only 能力；`weapp-vite`、`@weapp-vite/ast`、`@wevu/compiler`、`wevu`、`@wevu/api`、`@weapp-vite/web` 与 `weapp-ide-cli` 则统一消费这套 contract，补齐 `a` / `tt` / `s` 等结构指令识别、默认平台回退、配置读取与多宿主 bridge 挂载逻辑，减少核心链路里散落的 `wx` 单宿主假设。** [`27c655f`](https://github.com/weapp-vite/weapp-vite/commit/27c655f20e4f033cbefa0920a1b60a55343a22f1) by @sonofmagic
  - 同时继续扩展公共 API 与运行时类型面的宿主中立别名，包括 `miniProgramRouter`、`AutoRoutesMiniProgramRouter`、`WeapiMiniProgramMethodName`、`WeapiMiniProgramAdapter`、`WeapiMiniProgramRequestTask`、`WeapiMiniProgramRequestSuccessResult`、`MiniProgramRequestMethod`、`MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramRouter`、`MiniProgramLaunchOptions` 等，并保持原有 `wx` / `WeapiWx*` 兼容导出不变。这样后续接入支付宝小程序、抖音小程序、百度小程序等宿主时，可以逐步迁移到统一的小程序命名与共享平台能力，而不需要继续把公共类型和内部模板协议绑定到微信前缀。
  - 在 Web 运行时侧，也继续把多平台桥接协议做成宿主中立模型：`canIUse` 支持解析 `wx.*`、`my.*`、`tt.*` 等前缀，模板事件属性默认输出 `data-mp-on-*` / `data-mp-on-flags-*`，并把 bridge 同步挂到 `wx`、`my`、`tt`、`swan`、`jd`、`xhs` 等宿主全局对象上。这样同一套运行时与工具链在多小程序平台之间更容易复用，也为后续平台接入继续收窄改造面。
- 📦 **Dependencies** [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3)
  → `@weapp-core/shared@3.0.4`, `@wevu/api@0.2.4`, `@wevu/compiler@6.15.7`

## 6.15.6

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.15.6`

## 6.15.5

### Patch Changes

- 🐛 **修复 `wevu` 在小程序 IDE 运行时中的两类稳定性问题：一是页面布局运行时错误地引用未定义常量导致布局切换失败；二是 `useNativeRouter()` / `useNativePageRouter()` 在相对路径导航与跨页面调用场景下的路径语义不稳定。同时补齐相关 `e2e:ide` 与 `e2e:ci` 回归覆盖，避免压缩别名和共享 chunk 产物路径变化再次造成误报。** [`eedc149`](https://github.com/weapp-vite/weapp-vite/commit/eedc149b8c5668ee3dc86008de27b83609efeb6c) by @sonofmagic

- 🐛 **为 Vue 模板的 `htmlTagToWxml` 转换补充默认标签语义 class 注入能力：当 `.vue` 中的 HTML 标签被转换为小程序内置标签时，会默认追加原标签名 class（如 `h3 -> <view class="h3">`、`br -> <view class="br" />`），便于用户自行用 CSS 低成本恢复默认外观；同时新增 `vue.template.htmlTagToWxmlTagClass` 开关，支持按需关闭该行为。** [`5f21605`](https://github.com/weapp-vite/weapp-vite/commit/5f21605625cc29e206650890438e8be53d3311de) by @sonofmagic
- 📦 **Dependencies** [`5f21605`](https://github.com/weapp-vite/weapp-vite/commit/5f21605625cc29e206650890438e8be53d3311de)
  → `@wevu/compiler@6.15.5`

## 6.15.4

### Patch Changes

- 🐛 **修复 `weapp-vite` 等公开包对 `@weapp-core/constants` 发布依赖被锁定为精确版本的问题，并补充 constants 包变更必须带 changeset 的发布校验，避免共享常量新增导出后用户安装到旧版 constants 产物时出现运行时报错。** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446) by @sonofmagic
- 📦 **Dependencies** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446)
  → `@weapp-core/constants@0.1.1`, `@wevu/compiler@6.15.4`

## 6.15.3

### Patch Changes

- 🐛 **恢复 `wevu` 对外导出的 `WevuComponentConstructor` 类型别名，修复 lib 模式生成的声明文件在引用 `import("wevu").WevuComponentConstructor` 时出现的类型回归，避免 `e2e-apps/lib-mode` 与下游依赖 `wevu` 类型入口的项目在 `tsd`/类型检查阶段报错。** [`3e17ae6`](https://github.com/weapp-vite/weapp-vite/commit/3e17ae62fdcaac1910cbfdbba52ef944d876fa92) by @sonofmagic

- 🐛 **修复 `wevu` 响应式/只读包装对 `Date`、`Map`、`Set`、`WeakMap` 与 `WeakSet` 等内置对象的错误代理行为。现在 `reactive()`、`shallowReactive()`、`readonly()` 与 `shallowReadonly()` 会直接返回这些内置对象本身，不再生成不可靠的 Proxy；同时为集合类型保留后续引入专用 collection handlers 的扩展注释，避免当前出现“被代理但方法绑定异常”的半可用状态。** [#451](https://github.com/weapp-vite/weapp-vite/pull/451) by @Sun79
- 📦 **Dependencies**
  → `@wevu/compiler@6.15.3`

## 6.15.2

### Patch Changes

- 🐛 **修复 Vue 3.4 `v-bind` shorthand 在小程序模板编译中的兼容性问题。现在除了普通属性绑定外，`:foo-bar`、`:class`、`:style`、`:ref`、`<slot :name />` 与 `<component :is />` 等场景都会按 Vue 3.4 语义回退到同名表达式，并正确处理 kebab-case 到 camelCase 的变量映射，避免编译后丢失绑定或把动态组件错误降级为普通标签。** [#449](https://github.com/weapp-vite/weapp-vite/pull/449) by @sonofmagic

- 🐛 **修复 `wevu` 的组件模板 ref 类型链路，补齐对 Vue 3.5 `DefineComponent` 额外泛型的透传，并让 `defineComponent()` 返回的组件定义继续对齐 `DefineComponent` 公共实例类型。现在通过 `ref()` 或 `useTemplateRef()` 引用带 `defineExpose()` 的组件时，暴露成员、`$refs` 与 `$el` 等类型信息都能被正确推导，不再出现“功能正常但类型报错”的问题。** [#449](https://github.com/weapp-vite/weapp-vite/pull/449) by @sonofmagic
- 📦 **Dependencies** [`1fd4b09`](https://github.com/weapp-vite/weapp-vite/commit/1fd4b0908a02b28176b0e668edbbb95b7bb9dd97)
  → `@wevu/compiler@6.15.2`

## 6.15.1

### Patch Changes

- 🐛 **修复组件 props 在传入 `undefined` 后被小程序运行时视为 `null` 时的兼容缺口。`wevu` 现在提供显式的 `allowNullPropInput` 开关，并补齐显式 `properties` 分支的归一化逻辑；`weapp-vite` 则把该行为接入 `vite.config.ts` 的 `weapp.wevu.defaults.component.allowNullPropInput` 默认值体系中，Vue SFC 默认保持开启，也允许项目侧统一关闭，避免微信开发者工具对 `String` / `Number` 等已声明类型 props 反复输出 `null` 类型告警。** [`2fda07a`](https://github.com/weapp-vite/weapp-vite/commit/2fda07a604e64608b976a7782e7f1dbb4308aef4) by @sonofmagic

- 🐛 **收敛 `appPrelude` 与 `requestRuntime` 的默认注入路径，并修复默认开启 `allowNullPropInput` 后无 props 页面在小程序运行时触发 `Object.entries(undefined)` 的问题。现在 `weapp.appPrelude.requestRuntime` 在 `require` 模式下会优先安装到 `app.prelude.js`，对应的 DevTools 运行时用例已覆盖；同时无 props 的页面也不会再因为空属性归一化而在启动时崩溃。** [`195783b`](https://github.com/weapp-vite/weapp-vite/commit/195783b2be1c76f32d3657e4336845279c0cbd64) by @sonofmagic
- 📦 **Dependencies** [`db65791`](https://github.com/weapp-vite/weapp-vite/commit/db65791b4d042b3090d3f4eecae30d2cc6ca7da5)
  → `@weapp-core/constants@0.1.0`, `@wevu/compiler@6.15.1`

## 6.15.0

### Patch Changes

- 🐛 **为 Vue 模板编译新增 HTML 标签到 WXML 内置标签的映射能力：`.vue` 模板中的常见 HTML 标签现在会默认转换为对应的小程序标签，并支持通过 `vue.template.htmlTagToWxml` 自定义或关闭映射表。与此同时，`wevu` 的内置标签类型也补齐了这些 HTML 风格别名，避免在编辑器中为 `div`、`span`、`img`、`a` 等标签报出 `IntrinsicElements` 缺失错误，减少从 Web/Vue 项目迁移到 weapp-vite / wevu 时的模板改造成本。** [`87fcdd7`](https://github.com/weapp-vite/weapp-vite/commit/87fcdd78615b1d9b1ecdecda4946af4b75193bdd) by @sonofmagic

- 🐛 **压缩内联事件编译产物中的 dataset 属性名与 inline id：将 `data-wv-inline-id-*` / `data-wv-handler-*` / `data-wv-event-detail-*` 分别缩短为 `data-wi-*` / `data-wh-*` / `data-wd-*`，并把 `__wv_inline_*` 形式的内联表达式 id 缩短为更短的稳定 id。运行时同步支持新旧 dataset key 的兼容读取，以减少大型小程序项目的 WXML 包体积，同时避免历史产物在升级后直接失效。** [#442](https://github.com/weapp-vite/weapp-vite/pull/442) by @sonofmagic
- 📦 **Dependencies** [`87fcdd7`](https://github.com/weapp-vite/weapp-vite/commit/87fcdd78615b1d9b1ecdecda4946af4b75193bdd)
  → `@wevu/compiler@6.15.0`

## 6.14.3

### Patch Changes

- 🐛 **修复多个发布包在严格 TypeScript 校验下的类型问题，补齐 `tsd` 类型回归测试，并同步收敛 `wevu`、`@weapp-vite/mcp`、`@wevu/web-apis` 与 `create-weapp-vite` 的类型契约，减少后续重构时的类型回退风险。** [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75) by @sonofmagic
- 📦 **Dependencies** [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75)
  → `@wevu/compiler@6.14.3`

## 6.14.2

### Patch Changes

- 🐛 **修复 `defineOptions({ externalClasses: [...] })` 在 wevu `<script setup>` 宏中的类型提示缺失问题，并为 `weapp-vite-wevu-tailwindcss-tdesign-template` 增加 `virtualHost` 与外部样式类透传实验页，方便验证 `externalClasses`、`custom-class` 与 `rootStyle` 的推荐写法。** [`a7f2fa2`](https://github.com/weapp-vite/weapp-vite/commit/a7f2fa290ae48aa4719be64fd6b07c99e87795cb) by @sonofmagic
- 📦 **Dependencies** [`a9a725d`](https://github.com/weapp-vite/weapp-vite/commit/a9a725dd5115c141e95f10a112ce0e92de923f5c)
  → `@wevu/compiler@6.14.2`

## 6.14.1

### Patch Changes

- 🐛 **修复 `wevu` 在 `useTemplateRef()` 引用非 wevu 组件实例时的两个运行时问题：一是模板 ref 包装代理对原生实例不可配置属性返回了不符合 Proxy 规范的描述符，导致访问 `__data__` 等字段时抛错；二是 `shallowRef(null)` 初始值在后续参与 setData token 比较时缺少空值守卫，触发 `Object.hasOwn(null, ...)` 异常。** [#421](https://github.com/weapp-vite/weapp-vite/pull/421) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.14.1`

## 6.14.0

### Patch Changes

- 🐛 **修复 `wevu` App 全局事件在微信开发者工具中可能重复注册的问题，避免 `onError`、`onPageNotFound`、`onUnhandledRejection` 与 `onThemeChange` 在 `github-issues` 等 IDE 运行时场景下触发大量 listener 泄漏告警；同时清理 `issue-320` 复现页的路由初始化噪音，保持 IDE warning 报告聚焦真实异常。** [`f112199`](https://github.com/weapp-vite/weapp-vite/commit/f1121993ab02ed64862a43328ee1997c7d391ec5) by @sonofmagic

- 🐛 **修复 `wevu` 组件事件在空 payload 场景下的模板参数契约不一致问题。此前父组件通过直接 handler 或显式 `$event` 监听 `emit('empty')` 时，可能拿到整个事件对象而不是 `undefined`；现在在启用 `detail` 解包标记的组件事件中，空 payload 会和普通 payload 一样统一按 `detail` 语义传递，同时补充了编译产物、单元测试与微信开发者工具运行时验证，覆盖 direct handler、显式 `$event`、内联 `$event.title`、原生事件透传、tuple payload 与带 options 的 `emit` 写法。** [#412](https://github.com/weapp-vite/weapp-vite/pull/412) by @sonofmagic
- 📦 **Dependencies** [`e001dfe`](https://github.com/weapp-vite/weapp-vite/commit/e001dfe7f2ccc6db95668af627a9b7cfc6d4b6ad)
  → `@wevu/api@0.2.3`, `@wevu/compiler@6.14.0`

## 6.13.4

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.13.4`

## 6.13.3

### Patch Changes

- 🐛 **修复 `wevu` 页面中 `onPageScroll()` 只注册到组件选项、未同步桥接到页面实例的问题。现在页面实例会暴露可调用的 `page.onPageScroll`，因此真实滚动分发路径与依赖页面实例 hook 的业务 fallback 都能收到滚动事件。** [#406](https://github.com/weapp-vite/weapp-vite/pull/406) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.13.3`

## 6.13.2

### Patch Changes

- 🐛 **为 `wevu` 补充与 Vue 3 对齐的 `version` 兼容能力。现在既可以从 `wevu` 主入口直接导入 `version`，也可以通过 `createApp()` 返回的 app 实例读取 `app.version`；同时 `wevu/vue-demi` 改为复用 `wevu` 自身的版本导出，避免在 `vue -> wevu` alias 场景下继续直接引用 `vue` 而引发循环依赖。** [`48695e3`](https://github.com/weapp-vite/weapp-vite/commit/48695e342bcf0959b20ccb58636ac125ca09f2b5) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.13.2`

## 6.13.1

### Patch Changes

- 🐛 **同步升级 workspace catalog 与 `create-weapp-vite` 模板 catalog 中的 Vue 相关依赖版本，统一到 `3.5.32`，并刷新 `@types/node`、`@tanstack/vue-query` 及锁文件，确保工作区内发布包、示例应用与脚手架生成结果使用一致的依赖基线。** [`d2ea11e`](https://github.com/weapp-vite/weapp-vite/commit/d2ea11efc6b2248a9a5ee6e5e692646c0562a211) by @sonofmagic
- 📦 **Dependencies** [`d2ea11e`](https://github.com/weapp-vite/weapp-vite/commit/d2ea11efc6b2248a9a5ee6e5e692646c0562a211)
  → `@wevu/compiler@6.13.1`

## 6.13.0

### Patch Changes

- 🐛 **修复 `wevu` runtime 在小程序环境缺失 `AbortController` / `AbortSignal` 时，`@tanstack/vue-query` 查询会一直停留在 `pending` 的问题，并补齐 setup 返回普通对象内嵌响应式值时的更新跟踪。** [`140efee`](https://github.com/weapp-vite/weapp-vite/commit/140efeea1fa7b274bbe697962774d55c2b92bdec) by @sonofmagic

- 🐛 **补全 wevu 的 Vue 兼容 API，新增 `watchPostEffect()`、`watchSyncEffect()`、`isProxy()`、`isReadonly()` 与 `app.provide()`，便于 `app.use()` 安装依赖这些能力的生态插件。** [`1e53f10`](https://github.com/weapp-vite/weapp-vite/commit/1e53f10a65d1f2fa349bcf2b355008413e20d3c3) by @sonofmagic

- 🐛 **为 `app.vue` 的 `<script setup>` 新增 `use(plugin, ...options)` 运行时辅助 API，用于在 app 级 setup 上下文中表达 `app.use(...)` 风格的插件安装。这样像 `@tanstack/vue-query` 这类依赖 `install(app)` 的插件可以直接在 `wevu` 的 app SFC 入口中完成注册，同时保留现有 `provide()` 作为 `app.provide(...)` 的等价写法。** [`db7c01e`](https://github.com/weapp-vite/weapp-vite/commit/db7c01e92f108850639a7bb36a3c3f2578d90feb) by @sonofmagic

- 🐛 **修复 `app.vue` 中 `defineAppSetup()` 需要手动从 `wevu` 导入的问题。现在 `defineAppSetup` 会像其他 SFC 宏一样自动注入运行时导入，并同步补齐全局类型声明与编译测试，允许在 `<script setup lang="ts">` 中直接编写 `defineAppSetup((app) => app.use(...))`。** [`0bfdded`](https://github.com/weapp-vite/weapp-vite/commit/0bfdded627071e594f6b37d84d2e2f84103c5642) by @sonofmagic

- 🐛 **为 `app.vue` 的 `<script setup>` 补充 `defineAppSetup((app) => { ... })` API，让应用入口可以显式拿到 `app` 并执行 `app.use(...)`、`app.provide(...)` 这类 app 级注册逻辑，更贴近 Vue 的 `createApp(...).use(...)` 心智，同时保持小程序运行时的受控边界。** [`87206fd`](https://github.com/weapp-vite/weapp-vite/commit/87206fd08cb0848d10fc9eafd7c688a99a6ca346) by @sonofmagic

- 🐛 **新增 `wevu/vue-demi` 兼容入口，并让 `weapp-vite` 默认将 `vue-demi` 解析到该入口，降低 `@tanstack/vue-query` 等 Vue 生态库在小程序项目中的接入成本。** [`7e5680e`](https://github.com/weapp-vite/weapp-vite/commit/7e5680e146ab3cd3df6262f87a23ace97415d8ad) by @sonofmagic

- 🐛 **修复小程序请求兼容主路径：优先通过 `weapp-vite` 编译期按需向入口产物注入 `AbortController` / `AbortSignal`，并把 `wevu` 中原本默认执行的 runtime 中止控制器安装降级为显式 fallback。同时让 `weapp-vite` 的 request globals runtime 直接桥接小程序原生 `request`，使 `fetch` / `XMLHttpRequest` 兼容不再依赖 `wevu/fetch` 才能工作。** [`d2f406f`](https://github.com/weapp-vite/weapp-vite/commit/d2f406f25e88b9e7f787452978ece1f5d99a597f) by @sonofmagic

- 🐛 **为 `wevu.createApp()` 增加 `app.onUnmount()` 与 `app.unmount()`，增强对 `@tanstack/vue-query` 等依赖应用级卸载钩子的 Vue 插件兼容性。** [`c7234ec`](https://github.com/weapp-vite/weapp-vite/commit/c7234ecd4ef830e5cedb6a61894857323537ebd2) by @sonofmagic

- 🐛 **优化 `wevu` 的依赖注入语义：当 `provide()` 在 app `setup()` 中调用时，现会自动同步为应用级全局注入，使 `app.vue` 可以直接使用普通 `provide()` 为页面和组件提供 app 级依赖，不再必须手动改用 `provideGlobal()`。** [`0be6e59`](https://github.com/weapp-vite/weapp-vite/commit/0be6e59892bb00aafeddf8a65936c1844c766192) by @sonofmagic
- 📦 **Dependencies** [`0bfdded`](https://github.com/weapp-vite/weapp-vite/commit/0bfdded627071e594f6b37d84d2e2f84103c5642)
  → `@wevu/compiler@6.13.0`

## 6.12.4

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.12.4`

## 6.12.3

### Patch Changes

- 🐛 **优化 `wevu` 的 `toPlain` 热路径，减少高频 `setData` flush 中递归序列化时的临时对象分配与回调开销。对于类似 runtime-bench 里的大数组微提交场景，可进一步降低 `metricMs` 与 `flushMs`，缩小 wevu 与原生运行时之间的提交收敛差距。** [`b7c8bbf`](https://github.com/weapp-vite/weapp-vite/commit/b7c8bbfcc1784ed17d7623c5dfb44b3928d5ae9a) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.12.3`

## 6.12.2

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.12.2`

## 6.12.1

### Patch Changes

- 🐛 **修复 `wevu` 中 setup store 首次在页面 `setup()` 作用域内创建后，会在 `reLaunch` 卸载旧页面时连同 store 内部的响应式 effect / computed 一起被停止的问题。现在 store 创建过程会使用独立的 detached effect scope，不再附着到页面实例生命周期，从而保证跨页面共享 store 在 `reLaunch` 后更新状态时，`computed` 结果仍能继续正确响应。同时补充 `github-issues` 中 issue #373 的复现页面，以及对应的单测与 e2e 回归覆盖。** [#374](https://github.com/weapp-vite/weapp-vite/pull/374) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.12.1`

## 6.12.0

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.12.0`

## 6.11.9

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.9`

## 6.11.8

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.8`

## 6.11.7

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.7`

## 6.11.6

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.6`

## 6.11.5

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.5`

## 6.11.4

### Patch Changes

- 🐛 **修复 `wevu` 组件模板 ref 代理在写入自定义字段时没有回写到真实组件实例的问题，避免 layout 内承载的 `t-dialog` 在通过 `useDialog()` 打开后出现确认、取消按钮无法关闭弹窗的情况。同步补强 TDesign wevu 模板中的 dialog 宿主关闭兜底逻辑，并增加对应的运行时单测与 DevTools e2e 回归用例。** [`3ca1671`](https://github.com/weapp-vite/weapp-vite/commit/3ca1671ba853cf859e8cbbb81e93c5ad186ee8aa) by @sonofmagic

- 🐛 **修复 `wevu` 组件模板 ref 在代理实例方法时丢失 `this` 的问题，使 layout 内通过 `useTemplateRef()` 获取到的 `t-toast`、`t-dialog` 宿主可以直接调用公开方法。同步简化 TDesign wevu 模板中的 layout 反馈宿主写法，默认改为使用语义化 bridge key 解析共享 toast/dialog，不再依赖 `#t-toast`、`#t-dialog` 这类基于 id 的选择器桥接。** [`43a157d`](https://github.com/weapp-vite/weapp-vite/commit/43a157d88cc651678333b3f7c90a31a343c5b952) by @sonofmagic

- 🐛 **为 `wevu` 增加页面级反馈宿主运行时能力，允许 layout 在自身组件内注册 `t-toast` / `t-dialog` 等共享反馈节点，并让页面与子组件在调用封装的提示/确认方法时优先解析当前页面 layout 宿主。同步恢复两个 TDesign wevu 模板以 layout 承载共享反馈节点，并补充对应的运行时与构建校验，避免再次出现 `未找到组件,请检查selector是否正确` 的告警。** [`862b86c`](https://github.com/weapp-vite/weapp-vite/commit/862b86cd03806f8e7cc284dd706f111a60fb808d) by @sonofmagic

- 🐛 **为 `wevu` 增加 `useLayoutHosts()`、`resolveLayoutHost()` 与 `waitForLayoutHost()`，将 layout 共享宿主的注册、解析与就绪等待能力下沉到运行时，减少模板侧重复编写 bridge key、重试与 `selectComponent` 适配逻辑。同步简化两个 TDesign wevu 模板中的 toast/dialog hooks 与 layout 注册写法，使页面和组件调用 layout 内反馈能力时更直接、更容易维护。** [`ea8dcb0`](https://github.com/weapp-vite/weapp-vite/commit/ea8dcb038796d73f6f6161a6782f82dc355ca72c) by @sonofmagic

- 🐛 **为 `layout-host` 增加通用的编译期声明与运行时实例解析机制：layout 内组件可直接用 `layout-host="..."` 暴露宿主，`wevu` 会优先从运行时已解析的宿主实例读取能力，减少页面/组件侧对 `selector`、`id`、`useTemplateRef()` 和手动注册 bridge 的依赖。同步修复 `weapp-vite` 在 layout 构建时错误输出 scriptless stub 的问题，并更新 TDesign wevu 模板与 DevTools e2e，用例覆盖首页 toast、layout-feedback 页面 alert/confirm 以及无 `未找到组件` 警告的场景。** [`e52f7b1`](https://github.com/weapp-vite/weapp-vite/commit/e52f7b1f00b9007bd4a25b2414bc52f5a30890aa) by @sonofmagic

- 🐛 **修复 `wevu` 中 `setPageLayout()` 在页面 `watch` / `watchEffect` 回调里调用时可能丢失页面上下文的问题。现在页面实例会更早挂载 layout setter，响应式监听回调也会恢复创建时的当前实例；同时 `setPageLayout()` 会优先回退到运行时维护的当前页面实例，使 `setup()` 内部的 `immediate` watcher 以及后续响应式切换都能稳定驱动 layout 更新。同步更新 TDesign wevu 模板中的 store-layout 演示页，重新使用 watcher 驱动 `setPageLayout()` 以覆盖这一场景。** [`3ba325a`](https://github.com/weapp-vite/weapp-vite/commit/3ba325ac4538637f8828c5a4cc3c3815ebce10a7) by @sonofmagic
- 📦 **Dependencies** [`e52f7b1`](https://github.com/weapp-vite/weapp-vite/commit/e52f7b1f00b9007bd4a25b2414bc52f5a30890aa)
  → `@wevu/compiler@6.11.4`

## 6.11.3

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.3`

## 6.11.2

### Patch Changes

- 🐛 **增强 `defineOptions` 的类型能力与 Volar 模板绑定识别：`wevu` 现在支持更完整的工厂签名与原生 `properties/data/methods` 类型推导，Volar 插件会把 `defineOptions` 中声明的模板绑定注入到模板类型检查上下文里。同时补齐 retail 模板中相关订单按钮组件的本地类型与交互缺陷，降低脚本侧类型噪音并修复遗漏的方法调用问题。** [`aef4a30`](https://github.com/weapp-vite/weapp-vite/commit/aef4a30c974c566dc181cc7152e04c96d0f6e41e) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.11.2`

## 6.11.1

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.11.1`

## 6.11.0

### Minor Changes

- ✨ **为 `weapp-vite` 新增了接近 Nuxt `app/layouts` 的页面布局能力：支持在 `src/layouts` 目录中约定 `default` 或命名布局，并通过 `definePageMeta({ layout })` 为页面声明使用的布局，同时支持 `layout: false` 显式关闭默认布局。布局组件既可以使用 Vue SFC，也可以使用原生小程序组件；编译阶段会自动包裹页面模板、注入布局组件的 `usingComponents` 配置，并让页面内容通过布局内的 `<slot></slot>` 渲染，同时提供对应的宏类型声明。** [`35a6ee0`](https://github.com/weapp-vite/weapp-vite/commit/35a6ee06d7b8fa56435684011cc706ea5bf9f432) by @sonofmagic
  - 此外，`definePageMeta` 现已支持对象写法的布局配置，例如 `layout: { name: 'panel', props: { sidebar: true, title: 'Dashboard' } }`。当前会将静态字面量 `props` 编译为布局标签属性，并同时覆盖 Vue 布局与原生小程序布局场景。
  - 同时，`weapp-vite` 现在会将默认生成的 `components.d.ts`、`typed-components.d.ts`、`typed-router.d.ts`、`auto-import-components.json` 等支持文件统一输出到项目根目录下的 `.weapp-vite/` 中，并建议通过 `.gitignore` 忽略该目录，减少源码目录中的生成噪音。CLI 新增了 `weapp-vite prepare` 命令，可在开发、构建或类型检查前预先生成这批文件；相关模板与示例项目的 `tsconfig` 和脚本也已同步调整到新的输出目录。仓库模板与 `apps/*` 现在默认在 `postinstall` 阶段执行 `weapp-vite prepare`，Tailwind 场景会在 `weapp-tw patch` 之后继续生成 `.weapp-vite` 支持文件，行为上更接近 Nuxt 的 `nuxt prepare`；`e2e-apps/*` 仍保持轻量，不默认加入这一步以避免放大测试夹具安装成本。

### Patch Changes

- 🐛 **放宽 `wevu` 组件与应用的 `data` 类型签名，使其同时支持对象字面量与函数返回对象两种写法。现在 `defineComponent({ data: { ... } })` 与 `createApp({ data: { ... } })` 都会被正确接受并初始化，更贴近微信原生 `Component` / `App` 的使用方式，同时保留原有函数写法的兼容性。** [`77b2437`](https://github.com/weapp-vite/weapp-vite/commit/77b2437fe701f6f902e04505e81d961747e9f1e0) by @sonofmagic

- 🐛 **补齐并优化了 `wevu` 的一组 Vue 兼容 API。现在根入口正式导出 `shallowReadonly()` 与 `hasInjectionContext()`，其中 `shallowReadonly()` 复用现有浅只读语义，便于直接迁移依赖 Vue 兼容接口的组合式逻辑；`hasInjectionContext()` 则可用于在 `setup()` 同步阶段安全探测当前是否存在注入上下文。** [`4c39177`](https://github.com/weapp-vite/weapp-vite/commit/4c391770694c03c2c82065b5c419e337a2a14986) by @sonofmagic
  - 同时，`wevu` 运行时会在组件/页面的 `setup()` 阶段建立实例级 `effectScope`，使 `getCurrentScope()`、`onScopeDispose()`、以及 setup 内创建的 `watch`/`watchEffect` 与 Vue 3 行为更一致，并在实例卸载时自动停止这些作用域副作用，避免残留监听泄漏到卸载后。

- 🐛 **修复 lib 模式下的声明生成回归。`weapp-vite` 现在在调用 `rolldown-plugin-dts` 时会自动识别带有 `references` 的 `tsconfig`，并切换到 build mode，避免 `templates/weapp-vite-lib-template` 执行 `pnpm build:lib` 时因 project references 直接失败；同时 `wevu` 补充导出 `defineComponent` 类型 props 重载相关的公开类型，避免 Vue SFC 声明生成时泄漏到不可命名的内部类型，导致组件库 dts 产物构建报错。** [`8e78ad0`](https://github.com/weapp-vite/weapp-vite/commit/8e78ad02dee3a36ec411fbcf2fa143bf9a3766df) by @sonofmagic
- 📦 **Dependencies** [`35a6ee0`](https://github.com/weapp-vite/weapp-vite/commit/35a6ee06d7b8fa56435684011cc706ea5bf9f432)
  → `@wevu/compiler@6.11.0`

## 6.10.2

### Patch Changes

- 🐛 **修复 wevu 运行时在微信开发者工具热重载场景下可能产出无原型对象，导致 scoped slot 与 setData 快照参与 WXML 更新时触发 `hasOwnProperty is not a function` 报错的问题。** [`602143a`](https://github.com/weapp-vite/weapp-vite/commit/602143a906e2cdb04534cd9238ba7bcb438282c6) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.10.2`

## 6.10.1

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.10.1`

## 6.10.0

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.10.0`

## 6.9.1

### Patch Changes

- 📦 **Dependencies** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140)
  → `@wevu/api@0.2.2`, `@wevu/compiler@6.9.1`

## 6.9.0

### Patch Changes

- 📦 **Dependencies** [`3836235`](https://github.com/weapp-vite/weapp-vite/commit/3836235d8784ce0e5e1bd4c920f33a82d4c28844)
  → `@wevu/compiler@6.9.0`

## 6.8.0

### Minor Changes

- ✨ **调整 `wevu/router` 的创建与获取语义：新增 `createRouter()` 作为显式创建入口，`useRouter()` 只负责获取已创建的 router 实例，不再承担创建职责。同步更新相关测试与文档说明，推荐在应用入口或上层 `setup()` 中先调用 `createRouter()`，后续业务代码再通过 `useRouter()` 读取当前实例。** [`efdf1ee`](https://github.com/weapp-vite/weapp-vite/commit/efdf1ee19ef0d4d76db02468ed083355c69082d7) by @sonofmagic

### Patch Changes

- 🐛 **放宽 `wevu/router` 的 `createRouter({ routes })` 类型约束，允许路由记录只传 `path`，无需显式提供 `name`。当未提供 `name` 时，运行时会基于规范化后的路由路径自动生成名称，现有按名称解析与路由守卫行为保持不变。** [`319ed39`](https://github.com/weapp-vite/weapp-vite/commit/319ed39e0312bec9ade9008a65d79877c83108a0) by @sonofmagic
- 📦 **Dependencies** [`f3bacb9`](https://github.com/weapp-vite/weapp-vite/commit/f3bacb9197ae3ec248876dcff917a272b2009d0e)
  → `@wevu/api@0.2.1`, `@wevu/compiler@6.8.0`

## 6.7.7

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.7.7`

## 6.7.6

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.7.6`

## 6.7.5

### Patch Changes

- 🐛 **修复 issue #320 e2e 测试页面中 `addRoute` 同名替换验证逻辑：将 `path`（不含前导斜杠）改为 `fullPath`（含前导斜杠）进行路径比较，确保运行时断言与 e2e 测试期望值一致。同时新增 `addRoute` 同名替换的单元测试，覆盖 alias/redirect 替换、旧 alias 清理等场景。** [`7dda40a`](https://github.com/weapp-vite/weapp-vite/commit/7dda40a4f4a9f0f5e76cfdd3a81bf2fbd5c3a163) by @sonofmagic

- 🐛 **修复 issue #328 中 `<script setup>` 首帧数据与子组件 prop 同步过晚的问题：编译产物现在会为可静态推导的 setup 初始值注入首帧 `data`，运行时注册阶段也会把这些初始数据同步保留到原生组件/页面定义中，避免父级 `ref('111')` 在首屏绑定到子组件 `String` prop 时先落成 `null` 并触发小程序类型 warning。同时补充 `github-issues` 的 issue-328 构建与 IDE 端到端回归用例，以及相关运行时/编译单测。** [`62619d9`](https://github.com/weapp-vite/weapp-vite/commit/62619d9b6b3e71afb99dc44bde51d6b0cfa1e322) by @sonofmagic

- 🐛 **修复 `defineComponent` 在未提供 `setup` 时仍然注册内部 `setupWrapper` 的问题，避免与首屏同步快照逻辑叠加后，在组件 `attached` 阶段同步多触发一次 `setData`。这样可以恢复无 `setup` 组件的挂载时序稳定性，消除合并 `main` 后在 CI 中出现的 `__wvOwnerId` 额外同步回归。** [#329](https://github.com/weapp-vite/weapp-vite/pull/329) by @sonofmagic
- 📦 **Dependencies** [`62619d9`](https://github.com/weapp-vite/weapp-vite/commit/62619d9b6b3e71afb99dc44bde51d6b0cfa1e322)
  → `@wevu/compiler@6.7.5`

## 6.7.4

### Patch Changes

- 🐛 **整合同时影响 weapp-vite、wevu 与 create-weapp-vite 的 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **eager-crews-cough.md**：为 `weapp-vite` 新增 `weapp.wevu.preset: 'performance'` 预设，并将 `autoSetDataPick` 与预设联动（可被显式布尔配置覆盖）；同时为 `wevu` 增加 `setData.highFrequencyWarning` 开发态高频调用告警能力（默认关闭，可按阈值开启与调优）。此外同步补充 website 配置与 runtime 文档，明确预设内容、覆盖规则与 FAQ。
  2. **odd-horns-repeat.md**：为 `wevu` 新增 `useUpdatePerformanceListener()` 组合式 API：可在 `setup()` 中注册 `setUpdatePerformanceListener`，并在 `onUnload/onDetached` 自动清理，返回 `stop` 句柄支持手动停止；同时补齐 `SetupContextNativeInstance` 的对应类型桥接与导出覆盖测试。 同时增强 `weapp-vite` 的 `weapp.wevu.preset: 'performance'` 默认值：在保留 `patch + suspendWhenHidden + highFrequencyWarning` 的基础上，默认追加 `diagnostics: 'fallback'`，便于开发态更快定位 `setData` 回退与体积问题，并补齐相关单测与配置注释。
  3. **quiet-donuts-wave.md**：修复 `wevu` 的 `props -> properties` 归一化能力缺口：新增对 `optionalTypes` 与 `observer` 的透传，数组类型会规范化为 `type + optionalTypes`，并在缺失 `type` 时回填 `null` 以贴近小程序 `properties` 语义。同时修复 `weapp-vite` 自动组件元数据提取逻辑，`json.properties` 现在会合并 `type` 与 `optionalTypes` 生成联合类型，避免 typed-components/html custom data 类型信息偏窄。
  4. **rich-foxes-walk.md**：为 `wevu` 新增 `useRouter()` 与 `usePageRouter()`：在 `setup()` 中可直接获取小程序 Router，并优先保持 `this.router / this.pageRouter` 的原生语义。针对基础库低于 `2.16.1` 或实例路由器缺失场景，运行时会自动回退到全局 `wx` 同名路由方法；同时补齐 `SetupContextNativeInstance` 的 `router/pageRouter` 类型声明，并引入可声明合并的 `WevuTypedRouterRouteMap`，支持按项目路由清单收窄 `url` 类型。 `weapp-vite` 的自动路由产物 `typed-router.d.ts` 现已自动注入对 `wevu` 的模块增强：当启用 `autoRoutes` 后，`useRouter()/usePageRouter()` 的 `navigateTo/redirectTo/reLaunch/switchTab` 会继承 `AutoRoutesEntries` 联合类型（并保留相对路径写法），降低路由字符串拼写错误风险。同时 `weapp-vite/auto-routes` 新增 `wxRouter` 导出，提供一组代理到全局路由 API 的类型化方法，便于在业务代码中直接获得路由参数约束。

- 🐛 **整合 wevu 路由与运行时能力增强相关 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic
  ## 变更摘要
  1. **blue-apples-jump.md**：对齐 `wevu/router` 的导航钩子调用心智：`beforeEach` / `beforeResolve` 统一支持 `(to, from, context?)`，`afterEach` 支持 `(to, from, failure?, context?)`，让默认使用方式与 Vue Router 更一致，同时保留 `context` 作为高级扩展参数。
  2. **blue-halls-listen.md**：为 `wevu` 新增 `usePageScrollThrottle()` 组合式 API：可在 `setup()` 中直接注册节流版 `onPageScroll` 回调，支持 `interval`、`leading`、`trailing` 选项，并返回 `stop` 句柄用于手动停止监听。 该能力会在 `onUnload/onDetached` 自动清理挂起的 trailing 定时器，避免页面销毁后残留滚动任务；同时补齐运行时导出覆盖与类型测试，确保 API 可用性与类型推导稳定。
  3. **bright-falcons-cheer.md**：为 `wevu/router` 增加 `onError()` 订阅能力，用于集中处理路由守卫抛错等异常型导航失败；同时保留 `afterEach` 对所有导航结果的统一收敛，减少 duplicated/cancel 等预期失败对异常监控的干扰。
  4. **calm-pets-fry.md**：在 `wevu/router` 中新增对齐 Vue Router 心智的基础能力：`useRoute()` 当前路由快照、`resolveRouteLocation()` 路由归一化，以及 `parseQuery()` / `stringifyQuery()` 查询串工具，便于在小程序环境中统一路由解析与类型约束。
  5. **chilly-wasps-enjoy.md**：`wevu/router` 新增 `RouteRecordRaw.children` 声明支持。现在可以在 `namedRoutes` 中使用树状路由配置，运行时会自动展平成可匹配记录，并支持子路由的 `resolve`、路径反查（`name/params` 推断）以及 `beforeEnter/redirect` 执行链路。同时，`children` 命中场景下 `resolve().matched` 会返回父到子的匹配链，`resolve().meta` 按父到子顺序进行浅合并，更贴近 Vue Router 心智模型。
  6. **cold-apricots-impress.md**：`wevu/router` 新增 `router.install(app?)` 兼容方法（no-op），用于提升与 Vue Router 插件调用形态的一致性，便于跨端共享代码时减少条件分支。该方法在小程序运行时不执行额外注册逻辑。
  7. **cool-needles-warn.md**：为 `wevu/router` 增加 `router.currentRoute` 只读引用，直接暴露当前路由状态并与 `onShow/onRouteDone` 等页面路由生命周期保持同步，进一步贴近 Vue Router 的使用心智；同步补充运行时与类型测试。
  8. **dirty-bees-work.md**：为 `wevu` 新增子路径入口 `wevu/router`，导出 `useRouter` / `usePageRouter` 及路由相关类型，便于按模块按需导入并统一路由类型约束。
  9. **early-olives-trade.md**：为 `wevu/router` 增加 `namedRoutes` 的运行时解析能力：支持 `{ name, params }` 在 `resolve/push/replace` 中映射到真实页面路径，并在静态路径命中时回填 `route.name`；同时对未配置路由名或缺失必填参数统一产出 `NavigationFailureType.unknown`（默认按 `rejectOnError` 拒绝），让命名导航行为更贴近 Vue Router 心智模型。
  10. **fair-hats-switch.md**：移除 `wevu/router` 中未发布的兼容别名 `useRouterNavigation`（以及 `UseRouterNavigationOptions`），将高阶导航入口统一收敛为 `useRouter()`，避免命名分叉带来的使用误解。
  11. **fair-spoons-visit.md**：完善 `wevu/router` 在嵌套路由场景下的 `alias` 语义：当父路由声明 `alias` 且子路由使用相对路径时，子路由会自动继承并展开父级 alias 路径，使 `resolve()`、路径匹配和守卫链在 alias 链路下保持一致。 同时补齐运行时 `addRoute(parentName, route)` 的行为一致性，确保动态注册的子路由同样继承父级 alias；并新增对应单测与对齐矩阵文档更新。
  12. **fast-eggs-try.md**：进一步增强 `wevu/router` 的导航管线：新增 `afterEach` 后置钩子（统一获取成功/失败上下文），并支持守卫返回 `{ to, replace }` 形式的重定向结果，让守卫可以显式控制重定向走 `push` 还是 `replace` 语义。
  13. **five-mangos-grab.md**：新增 `useIntersectionObserver()` 组合式 API：在 `setup()` 内可直接创建 `IntersectionObserver`，并在 `onUnload/onDetached` 时自动断开连接，降低手写清理逻辑与滚动轮询成本。同时增强 `setData.highFrequencyWarning`：在检测到 `onPageScroll` 回调中调用 `setData` 时输出专项告警（可配置冷却时间与开关），引导改用可见性观察或节流方案，并补充对应文档与类型定义。
  14. **funny-buses-whisper.md**：增强 `usePageScrollThrottle()`：新增 `maxWait` 选项，在持续滚动期间可限制“最长不触发时间”，避免仅依赖 `interval`/`trailing` 时长时间未回调。 同时补充 `maxWait` 相关边界测试与类型覆盖，确保 `leading`、`trailing`、`maxWait` 组合行为稳定，并保持卸载时定时器清理语义不变。
  15. **fuzzy-pigs-cheat.md**：为 `wevu` 新增子路径入口 `wevu/store` 与 `wevu/api`，其中 `wevu/api` 直接透传 `@wevu/api` 的能力，便于按需导入并保持与独立 API 包的一致接口。
  16. **good-pianos-juggle.md**：`wevu/router` 新增 `router.isReady()`，用于对齐 Vue Router 的可等待启动语义。在当前小程序运行时中该 Promise 会立即 resolve，便于统一业务层调用模式（例如在初始化流程中统一 `await router.isReady()`）。
  17. **green-bears-hear.md**：继续增强 `wevu/router`：新增 `beforeResolve` 守卫，并支持守卫返回重定向目标（字符串或路由对象）；同时为重定向链路加入 `maxRedirects` 上限控制，避免守卫循环重定向导致的无限导航。
  18. **green-cups-bow.md**：`wevu/router` 新增 `router.options` 只读配置快照，用于按 Vue Router 心智读取初始化参数（如 `paramsMode/maxRedirects/namedRoutes/tabBarEntries`）。该快照在路由器创建时确定，不会随着 `addRoute/removeRoute/clearRoutes` 的运行时变更而漂移，便于调试与诊断。
  19. **green-houses-smile.md**：为 `wevu` 的 `setData` 新增了两项运行时性能能力：`suspendWhenHidden` 用于页面/组件进入后台态后挂起并合并更新，在回到前台时再一次性下发；`diagnostics` 用于输出内建的 `setData` 诊断日志，便于定位高频更新、回退 diff 与 payload 体积问题，同时保持现有 `debug` 回调兼容。
  20. **green-lamps-brush.md**：`wevu/router` 新增 `routes` 兼容入口，用法与 Vue Router 更一致；同时保留 `namedRoutes` 作为兼容写法。初始化时支持同时传入 `routes` 与 `namedRoutes`，并约定同名记录由 `namedRoutes` 覆盖。 另外补齐 `router.options.routes` 快照输出、相关类型测试和文档示例，帮助业务逐步从旧写法迁移到 `routes` 心智。
  21. **green-zebras-think.md**：为 `wevu/router` 新增 `go(delta)` 与 `forward()` 导航方法：`go(<0)` 复用小程序 `navigateBack` 回退，`go(0)` 为无操作，`forward()` 在小程序路由能力受限场景下返回 `NavigationFailureType.aborted`。同时补充对应的运行时与类型测试，完善与 Vue Router 导航 API 的对齐体验。
  22. **itchy-points-begin.md**：为 `wevu/router` 增加 `paramsMode` 选项（`loose | strict`，默认 `loose`），用于控制命名路由 `params` 的容错行为：`strict` 模式下会校验并拒绝未被路径模板消费的多余参数，减少参数误传导致的隐性导航问题。同步补充运行时与类型测试覆盖。
  23. **late-poems-think.md**：`wevu/router` 调整 `removeRoute(name)` 在 `children` 场景下的行为：删除父路由时会连带删除其子路由记录，避免出现父路由已移除但子路由仍可匹配的状态偏差，更贴近 Vue Router 心智模型。
  24. **lazy-lions-film.md**：收敛 `wevu/router` 的 `router.options` 语义：现在会返回运行时冻结的初始化快照，避免业务侧误改配置导致的状态歧义。快照保持“初始化值”定位，不随 `addRoute/removeRoute/clearRoutes` 动态变化；动态路由状态请通过 `getRoutes()` 获取。 同时补充对应回归测试与文档说明，明确 `routes` 为推荐入口、`namedRoutes` 为兼容入口的迁移策略。
  25. **mighty-garlics-teach.md**：继续对齐 `wevu/router` 的 Vue Router 心智： - `useRouter` 新增 `parseQuery` / `stringifyQuery` 配置钩子，支持按实例自定义查询解析与序列化。 - 增加 hash-only 导航判定策略：当路径与查询等价、仅 `hash` 变化时返回 `aborted` 失败，避免在小程序原生路由层触发无效跳转。
  26. **neat-lions-swim.md**：补齐 `wevu/router` 的 `RouteLocation` 最小字段模型：新增 `hash` / `name` / `params`（含 `RouteParamsRaw` 归一化），并支持从 `fullPath` 解析 `hash`。为保持小程序兼容，原生 `navigateTo/redirectTo` 发送的 URL 会自动忽略 `hash`，仅在路由语义层保留该字段。
  27. **neat-pens-jam.md**：`wevu/router` 在 alias 命中场景下补充 `resolve().matched` 语义：保持 `matched.path` 为 canonical 路由路径，并在叶子记录上新增可选 `aliasPath` 字段标记实际命中的 alias 模板/路径，便于调试与埋点时区分“规范路径”与“alias 命中路径”。
  28. **neat-squids-dance.md**：收紧 `wevu/router` 初始化路由配置校验：当路由记录存在空 `name/path`、重复 `alias`（含与主路径相同）或循环 `children` 引用时，会输出告警并跳过无效部分，避免潜在的匹配歧义与递归风险。 同时补充回归测试，覆盖无效记录跳过、alias 归一化告警与循环引用处理，确保 `addRoute` 与初始化场景行为稳定。
  29. **odd-cups-beam.md**：`wevu/router` 新增 `addRoute(parentName, route)` 重载，支持以 Vue Router 心智将子路由动态挂载到已存在父路由下。子路由使用相对路径时会基于父路由路径自动拼接，并保持与 `removeRoute/hasRoute/getRoutes` 的一致行为。
  30. **old-emus-decide.md**：为 `wevu` 新增 `wevu/fetch` 子路径导出，基于 `@wevu/api` 的 `wpi.request` 提供与标准 `fetch` 对齐的核心行为：返回 `Promise<Response>`、HTTP 非 2xx 不抛错、网络失败抛 `TypeError`、支持 `AbortSignal` 取消、并对 `GET/HEAD` 携带 `body` 进行一致性校验。
  31. **olive-cameras-itch.md**：增强 `wevu/router` 的导航能力：`useRouterNavigation()` 新增 `beforeEach` 轻量守卫，并支持按 `tabBarEntries` 自动把 `push/replace` 分流到 `switchTab`，同时补充对应的失败判定与类型约束。
  32. **quick-cameras-wave.md**：`wevu/router` 完善 `children` 场景下的路由记录 `redirect` 执行语义：当目标命中父子匹配链时，会按匹配链优先处理父级 `redirect`。一旦命中重定向，后续子路由守卫将不再执行，行为更贴近 Vue Router 嵌套路由心智模型。
  33. **quiet-badgers-sparkle.md**：增强 `wevu/router` 的重名路由告警可读性：`routes` / `namedRoutes` 冲突时会输出来源与路径变化（例如 `routes:/old -> namedRoutes:/new`），帮助快速定位覆盖来源。 同时补齐动态路由替换的回归覆盖：`addRoute()` 同名替换后，验证 alias、beforeEnter、redirect、children 清理与静态匹配索引均按新记录生效，避免旧链路残留。
  34. **quiet-planes-check.md**：增强 `wevu/router` 的解析结果与路由记录行为：`resolve()` 结果新增 `href/matched/redirectedFrom` 扩展字段（可选），并在导航重定向链路中透出来源位置信息；同时补齐 `RouteRecordRaw` 子集能力的回归测试，覆盖 `meta` 注入、`beforeEnter` 与记录级 `redirect` 行为。
  35. **rare-brooms-argue.md**：为 `wevu` 新增 `onMemoryWarning()` App 生命周期能力：在 `setup()` 注册后，运行时会桥接 `wx.onMemoryWarning` 并在重复绑定时自动调用 `wx.offMemoryWarning` 清理旧监听，避免内存告警监听器累积。开发者可在回调中集中回收大缓存、临时对象与冗余订阅，同时补齐对应的类型定义、单测与 website 文档。
  36. **red-lamps-talk.md**：为 `wevu/router` 增加 `RouteRecordRaw` 子集能力（`meta`、`beforeEnter`、`redirect`），并将 `namedRoutes`、`getRoutes()`、`addRoute()` 升级到记录模型；导航流程新增路由记录级重定向与 `beforeEnter` 守卫执行，`resolve()` 可从命中记录注入 `meta`，进一步对齐 Vue Router 的路由心智模型。
  37. **rude-countries-yawn.md**：`wevu/router` 完善 `children` 场景下的 `beforeEnter` 执行语义：当目标命中父子链路时，`beforeEnter` 会按父到子顺序依次执行；若父级守卫返回重定向，后续子守卫将不再执行。该行为更贴近 Vue Router 的嵌套路由守卫心智模型。
  38. **silly-cobras-wave.md**：`wevu/router` 新增 `router.clearRoutes()`，用于一次性清空当前路由器实例中的命名路由记录（包含初始化和运行时动态添加的记录）。该能力与 `addRoute/removeRoute/getRoutes/hasRoute` 形成完整的路由记录管理闭环，便于迁移期重置路由表与测试隔离。
  39. **small-seas-knock.md**：调整 `wevu` 根入口的路由 helper 命名，移除易与 `wevu/router` 高阶导航混淆的 `useRouter()/usePageRouter()`，统一改为 `useNativeRouter()/useNativePageRouter()`；同时在注释中明确推荐优先使用 `wevu/router` 的 `useRouter()` 获取更完整的导航能力（守卫、失败分类与解析能力）。
  40. **sour-houses-listen.md**：为 `wevu/router` 增加运行时路由管理能力：新增 `addRoute()` 与 `removeRoute()`，并与 `hasRoute()/getRoutes()`、命名路由解析链路联动，使 `namedRoutes` 支持在运行时动态增删并立即生效。
  41. **swift-icons-fail.md**：进一步对齐 `wevu/router` 与 Vue Router 的导航 Promise 心智：默认情况下，守卫抛错等“异常型失败”会以 Promise reject 抛出；常规导航失败（如 duplicated/cancelled）仍通过返回值传递。新增 `UseRouterOptions.rejectOnError` 可关闭该行为，回退到始终返回失败对象的模式。
  42. **tall-bottles-push.md**：`wevu/router` 新增 `RouteRecordRaw.alias` 支持（字符串或字符串数组）。现在通过 alias 路径进行 `resolve/push/replace` 时，可以正确命中命名路由记录并推断 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
  43. **tame-geese-taste.md**：进一步分层 `wevu/router` 的路由配置校验策略：初始化阶段对无效记录采用“告警并跳过”（空 `name/path`、重复/无效 `alias`、循环 `children` 引用）；运行时 `addRoute()` 对根记录采用“失败即抛错”（缺失 `name/path` 或循环引用直接抛错）。 同时补充对应回归测试与文档说明，明确初始化与动态注册两条链路的容错等级，减少迁移期配置歧义。
  44. **tidy-bottles-joke.md**：收紧 `wevu` 路由类型：`switchTab` 现在使用仅绝对路径的独立类型约束，并支持通过 `WevuTypedRouterRouteMap.tabBarEntries` 进一步收窄为 tabBar 页面联合类型；未声明时回退到 `entries`。同时补充对应的类型测试与文档说明，明确 `switchTab` 不接受相对路径和查询参数。 同时修复一组运行时类型声明细节，消除 `wevu` 类型检查中的基线噪音：避免根导出里的重复 `ModelRef` 导出冲突，收敛 `setData` 适配器返回类型，并补齐若干严格模式下的显式类型注解。 另外补强 `createWevuComponent()` 的泛型推导，使其 `props` 写法在类型层与 `defineComponent()` 保持一致，并补充对应 `test-d` 断言。
  45. **tiny-countries-listen.md**：修复 `wevu/router` 的动态路径匹配能力：当通过路径形式导航到动态命名路由（如 `/pages/post/42/index`）时，现在可以正确推断路由记录并注入 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
  46. **tough-rice-wave.md**：增强 `wevu/router` 的路由配置可观测性与重名处理语义：初始化时若 `routes` 与 `namedRoutes`（或同一来源）存在同名路由，会输出告警并明确“后者覆盖前者”。 同时调整 `addRoute()` 的重名行为：新增同名路由时会先清理旧路由及其 `children` 链，再写入新记录，避免旧路径/旧子路由残留造成匹配歧义。并补充覆盖守卫、重定向、静态路径索引和 children 清理的回归测试与文档说明。
  47. **twelve-turtles-tickle.md**：在 `wevu/router` 中补充 Vue Router 风格的导航封装能力：新增 `useRouterNavigation()`（`push/replace/back/resolve`）、`NavigationFailureType`、`createNavigationFailure()` 与 `isNavigationFailure()`，用于统一处理小程序路由调用结果与失败分类。
  48. **wild-peaches-smell.md**：调整 `wevu/router` 的命名心智：将高阶导航入口统一为 `useRouter()`，并新增 `useNativeRouter()` / `useNativePageRouter()` 表达原生路由桥接语义；同时保留 `useRouterNavigation()` 作为兼容别名，便于渐进迁移。
  49. **wise-buses-jam.md**：为 `wevu/router` 新增 `hasRoute(name)` 与 `getRoutes()`，用于在运行时检查和读取 `namedRoutes` 映射；同时补齐命名路由在守卫重定向场景下的测试覆盖，确保 `{ name, params }` 目标可被一致解析并导航。
  50. **young-pears-glow.md**：为 `wevu` 新增 `useDisposables()` 组合式清理工具：在 `setup()` 中可统一注册清理函数或带 `dispose/abort/cancel/stop/disconnect/destroy/close` 方法的对象，并在 `onUnload/onDetached` 自动批量释放，支持幂等 `dispose()` 与取消注册。 同时提供 `bag.setTimeout()` / `bag.setInterval()` 计时器辅助，自动在销毁时清理 timer，减少页面与组件长期运行下的内存泄漏风险；并补齐导出覆盖、类型测试与运行时单测。
- 📦 **Dependencies** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e)
  → `@wevu/api@0.2.0`, `@wevu/compiler@6.7.4`

## 6.7.3

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.7.3`

## 6.7.2

### Patch Changes

- 📦 **Dependencies** [`41b049f`](https://github.com/weapp-vite/weapp-vite/commit/41b049f6bca3cd870343dd5b515597075e0c1686)
  → `@wevu/compiler@6.7.2`

## 6.7.1

### Patch Changes

- 🐛 **修复在 `setup()` 返回 `getCurrentSetupContext()` 时可能进入 `setData` 快照并触发递归爆栈的问题，同时补充对应回归测试，并将 composition api 的 weapp e2e 用例拆分为可单独执行的页面级 case。** [`8b76120`](https://github.com/weapp-vite/weapp-vite/commit/8b761206940c4e99c1f65b3663898660f448714d) by @sonofmagic

- 🐛 **本次变更主要修复了三类一致性与可维护性问题：一是 `wevu` 构建默认产物此前仅压缩且缺少 sourcemap，不利于排查线上问题，现调整为输出 sourcemap 以提升调试可观测性；二是 `weapp-vite` 侧 `oxc-parser` 与类型依赖升级到同一版本，降低 AST 解析与类型不匹配带来的潜在风险；三是同步更新 workspace catalog 与 `create-weapp-vite` 生成 catalog，避免模板初始化时依赖版本与仓库主线不一致。** [`17f30b1`](https://github.com/weapp-vite/weapp-vite/commit/17f30b169337d5bc015a46841807f964cc1e140f) by @sonofmagic
- 📦 **Dependencies** [`662630e`](https://github.com/weapp-vite/weapp-vite/commit/662630e7c12e49bf783d7e728618fbbad863ff3b)
  → `@wevu/compiler@6.7.1`

## 6.7.0

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.7.0`

## 6.6.16

### Patch Changes

- 📦 **Dependencies** [`a1ae4a6`](https://github.com/weapp-vite/weapp-vite/commit/a1ae4a6abe0374644a32d0078085bd662faae641)
  → `@wevu/compiler@6.6.16`

## 6.6.15

### Patch Changes

- 🐛 **修复 `wevu` 在小程序运行时 `setData` 快照与下发 payload 的引用污染问题：当 `computed` 返回对象并在模板读取其属性时，切换到其他引用再切回初始引用会被错误判定为未变化。现在会在内部快照与 `setData` 下发前做隔离拷贝，确保 `option.label` 这类绑定在引用往返后仍能正确更新。** [`da5b206`](https://github.com/weapp-vite/weapp-vite/commit/da5b20637dda06f67207f36952ef4115005456dd) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.6.15`

## 6.6.14

### Patch Changes

- 📦 **Dependencies** [`39227de`](https://github.com/weapp-vite/weapp-vite/commit/39227de97e3d6e4e1f82b14a6ce5e8bce918b0d9)
  → `@wevu/compiler@6.6.14`

## 6.6.13

### Patch Changes

- 🐛 **修复 `wevu` 组件侧 `pageLifetimes.routeDone` 的生命周期桥接，确保在组件中可通过 `onRouteDone` 正常接收页面路由动画完成事件；同步补齐相关运行时测试与文档映射说明（`lifetimes/pageLifetimes` 与组合式 API 的对应关系），避免与微信官方生命周期定义不一致。** [`6742994`](https://github.com/weapp-vite/weapp-vite/commit/6742994ffd0a3c522d1e527e0d90e4863a2d853c) by @sonofmagic

- 🐛 **优化 Wevu API 文档的公开边界：移除 API 页面中不应面向业务侧展示的内部接口，并在运行时源码中为内部能力补充 `@internal` 标注；同时将 `provideGlobal` / `injectGlobal` 标记为 `@deprecated`（保留导出用于兼容过渡），统一文档与实际导出语义，降低误用内部能力的风险。** [`c7f37ac`](https://github.com/weapp-vite/weapp-vite/commit/c7f37acc6cab3acc8cef50154f840ef71cc42cb4) by @sonofmagic

- 🐛 **对齐 `wevu` 对外 `PropType<T>` 的类型行为到 Vue 官方定义，支持 `type: [String, null]` 等构造器数组写法，并修复该场景下 `InferPropType` 对 `null` 推导退化为 `any` 的问题，保证与 Vue utility types 的使用体验一致。** [`86c7300`](https://github.com/weapp-vite/weapp-vite/commit/86c73009267c18219b2dfbf5772e7f182827cbbd) by @sonofmagic
- 📦 **Dependencies** [`ebdd313`](https://github.com/weapp-vite/weapp-vite/commit/ebdd313e94ebcbc0570b9bf1b44c2e403423d45a)
  → `@wevu/compiler@6.6.13`

## 6.6.12

### Patch Changes

- 🐛 **新增原生组件 `properties` 类型推导工具：`InferNativePropType`、`InferNativeProps`、`NativePropType`、`NativeTypeHint`、`NativeTypedProperty`，并在 `wevu-vue-demo` 与文档中补充 `script setup` 直接导入原生组件的推荐写法。现在可基于 `properties` 作为单一数据源生成 props 类型，并通过 `NativePropType<T>`（类似 Vue `PropType<T>`）为联合字面量提供更简洁的类型提示，减少手写接口与重复断言。** [`788a4e0`](https://github.com/weapp-vite/weapp-vite/commit/788a4e080a95524207754bd29316a1504c26b195) by @sonofmagic

- 🐛 **新增 `NativeComponent<Props>` 类型导出，用于简化原生小程序组件在 `script setup` 场景下的类型包装写法；同时补充 `wevu-vue-demo` 原生组件示例（含 `TS + SCSS` 版本）与对应页面引入演示，使原生组件 `props` 在模板中的智能提示与类型约束更稳定、易用。** [`ad8c631`](https://github.com/weapp-vite/weapp-vite/commit/ad8c631f7d1aa19e9f3ac70e5ddc68eb116862ef) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.6.12`

## 6.6.11

### Patch Changes

- 🐛 **修复同一节点绑定多个事件时的 inline 事件冲突：编译器为不同事件生成按事件名分片的 dataset 键（如 `data-wv-inline-id-tap`），运行时按 `event.type` 读取对应键并保持兼容回退。补充组件 `emit` 与 `$event` 的单元测试和 e2e 覆盖，并在 `wevu-vue-demo` 的 `vue-compat/template` 页面新增单节点多事件（参数 + `$event`）示例。** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509) by @sonofmagic

- 🐛 **导出 `customRef` 及其相关类型声明，完善 `wevu` 对 Vue 3 响应式 API 的可用性。同步扩展 `wevu-vue-demo` 的 `vue-compat` 响应式对照页，新增多源 watch cleanup、watchEffect 句柄控制、effectScope 生命周期、customRef 去抖、shallowReactive/markRaw/toRef 等复杂案例，并补齐能力矩阵与说明文档，确保 typecheck、eslint、stylelint 与 build 全量通过。** [`f881fd9`](https://github.com/weapp-vite/weapp-vite/commit/f881fd90a8a7501550c5a9bf448f810265c205ae) by @sonofmagic

- 🐛 **为 `defineModel` 增加 Vue 3 兼容的 tuple + modifiers 类型与运行时能力：支持 `const [model, modifiers] = defineModel()` 与修饰符泛型推导；同时扩展 `useModel` 的 get/set 选项以适配基于 modifiers 的值转换。补充 `tsd` 类型测试、运行时测试与 `weapp-vite` 的脚本编译测试，并同步更新 `wevu-vue-demo` 的 script-setup 兼容示例与矩阵结论。** [`fd5f8ce`](https://github.com/weapp-vite/weapp-vite/commit/fd5f8ce6bc23d106b43de524ac12d0cc10221c98) by @sonofmagic

- 🐛 **修复组件自定义事件在模板监听中的 `$event` 语义：编译期为组件事件注入 `data-wv-event-detail` 并将简单处理器按 inline 路径编译，运行时据此将 `$event` 解析为 `event.detail`，避免出现 `emit: undefined @ undefined`。同时补充 `wevu-vue-demo` 的 `$event` 上抛示例，并新增编译器、运行时与 e2e 集成测试覆盖。** [`e2aa20e`](https://github.com/weapp-vite/weapp-vite/commit/e2aa20e1cf79b4c5c3c36735b967c6fd5583486f) by @sonofmagic

- 🐛 **对 `wevu` 的 `ref` 类型声明进行兼容增强，新增无参重载以对齐 Vue 3 的使用习惯，并补充对应的类型测试覆盖。同步更新 `wevu-vue-demo` 示例，统一模板为 Vue 语法（`v-for` / `v-if` / `@tap` 等），修复 demo 中现存的 `vue-tsc` 与 eslint 问题，并将 Volar 模板类型库显式切换到 `wevu`，使小程序内置标签类型跳转指向 `wevu` 的 intrinsic elements 声明。** [`31e2db3`](https://github.com/weapp-vite/weapp-vite/commit/31e2db3337842e5fafee21d2d741b8f71643197d) by @sonofmagic
- 📦 **Dependencies** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509)
  → `@wevu/compiler@6.6.11`

## 6.6.10

### Patch Changes

- 🐛 **修复 `wevu` 运行时的多平台条件裁剪链路：统一通过 `import.meta.env.PLATFORM` 选择小程序全局对象（`tt/my/wx`），并将相关 runtime 入口（组件定义、App 注册、hooks、template refs、页面生命周期）改为走平台适配层，避免非目标平台分支进入最终产物。同时补充 `weapp-vite` npm 构建 define 透传与 e2e 覆盖，分别验证 `wevu` 位于 `devDependencies` 与 `dependencies` 时的构建行为与平台输出。** [`b248a4a`](https://github.com/weapp-vite/weapp-vite/commit/b248a4a6e04dc12dd190fa1b29b615191ed3be87) by @sonofmagic

- 🐛 **修复 `wevu` 运行时在 Node 环境加载时对 `import.meta.env.PLATFORM` 的直接读取问题：当 `import.meta.env` 不存在（如单元测试加载 `vite.config.ts`）时不再抛出异常，改为安全访问并继续走平台兜底逻辑，避免 `Cannot read properties of undefined (reading 'PLATFORM')` 导致构建/测试提前失败。** [`e6c326f`](https://github.com/weapp-vite/weapp-vite/commit/e6c326f64989ae4f0af40553405af19fb1e74f7d) by @sonofmagic

- 🐛 **补齐 `wevu` 在 Vue `<script setup>` 中 `defineProps/defineEmits` 的类型兼容能力：`defineEmits` 现已支持数组、对象、函数重载与命名元组写法，并对齐官方 `EmitFn` 推导行为；同时增强运行时 `ctx.emit`，兼容 `emit(event, ...args)` 多参数形式并按小程序 `triggerEvent` 规范化 `detail/options`。另外新增 `wevu` 与 `weapp-vite` 的类型/编译回归测试，覆盖这些写法的编译与类型校验链路。** [`3a7f4fe`](https://github.com/weapp-vite/weapp-vite/commit/3a7f4fe3e5dbedf6b7c6f09d0cb52e3f4871a792) by @sonofmagic

- 🐛 **修复 `wevu` 组件类型暴露导致的模板补全噪声问题：`defineComponent` 的公开返回类型不再把内部运行时字段作为可补全属性暴露，避免在 Vue SFC 中出现 `:__wevu_options`、`:__wevu_runtime` 及 symbol 序列化键提示。同时同步更新 `lib-mode` 的类型断言用例，确保构建产物导出的组件类型与新的公开契约保持一致。** [`db18a6a`](https://github.com/weapp-vite/weapp-vite/commit/db18a6a9ebd24252128d152190316b525db53380) by @sonofmagic

- 🐛 **修复 `wevu` 在 `createApp().mount()` 返回值上的类型冲突：`RuntimeInstance` 不再在对象字面量直接声明内部字段 `__wevu_touchSetupMethodsVersion`，改为运行时按不可枚举属性注入，消除 TypeScript 报错且不暴露内部实现细节。同步补充并修正 `tsd` 类型测试，覆盖 `RuntimeInstance` 的 `state/computed/methods/proxy/watch/bindModel` 推导行为，以及内部字段不可访问约束，确保类型契约在构建与消费场景下稳定。** [`4f1ebb6`](https://github.com/weapp-vite/weapp-vite/commit/4f1ebb63da9035f5777796ab371fae9db4c7a73f) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.6.10`

## 6.6.9

### Patch Changes

- 📦 **Dependencies** [`b6f2e49`](https://github.com/weapp-vite/weapp-vite/commit/b6f2e49c5a4642037b23feb2d1764e5915005869)
  → `@wevu/compiler@6.6.9`

## 6.6.8

### Patch Changes

- 🐛 **修复 `defineProps` 布尔类型在模板调用表达式（如 `String(bool)`）中的运行时绑定结果为 `undefined` 的问题（#300）。编译器现在会对模板运行时绑定标识符增加 `__wevuProps` 回退读取逻辑；运行时则预置并复用响应式 `__wevuProps` 容器，确保计算属性首次求值即可建立正确依赖并在 props 变更时稳定更新。** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de) by @sonofmagic
  - 同时补充对应的编译回归测试与运行时同步测试，覆盖 `script setup` 的 props 解构场景。

- 🐛 **修复 issue #300 场景下 `String(props.bool)` 在组件交互后不响应变更的问题，避免生成 `__wevuProps.props` 访问路径，并完善 props 同步与同名 setup 绑定的运行时处理及 e2e 回归测试。** [`9b2c623`](https://github.com/weapp-vite/weapp-vite/commit/9b2c623d7a6ca0b254ad55cc9a392ea8058e1141) by @sonofmagic

- 🐛 **修复 issue #300 场景下 `<script setup>` 中仅使用 `defineProps` 类型声明且未声明 `props` 变量时，模板调用表达式（如 `String(bool)`）在小程序运行时出现初始值错误或 props 变更后不响应的问题，并补充对应的构建与 IDE 端到端回归测试。** [`253fc99`](https://github.com/weapp-vite/weapp-vite/commit/253fc99ee8179e43c0ea96dded4773eed52c7663) by @sonofmagic

- 🐛 **修复 `wevu` 模板编译在小程序端对可选链表达式（`?.`）的兼容性问题：在模板编译阶段将 `?.` 安全降级为条件表达式，避免产物 WXML 在微信开发者工具中出现语法报错，并补充对应编译测试与集成测试覆盖。** [`3f1253e`](https://github.com/weapp-vite/weapp-vite/commit/3f1253e5bd1dbb320566e869d172048c63265a56) by @sonofmagic
  - 同时对 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 进行路由与页面结构对齐：同步主包与分包路由配置至 `tdesign-miniprogram-starter-retail`，补齐自定义 `tabBar` 形态，并将页面壳改为按路由渲染对应版式（如首页、分类、购物车、商品详情、订单列表与表单页等），确保新建项目默认页面可访问且排版语义更接近原零售模板。
- 📦 **Dependencies** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de)
  → `@wevu/compiler@6.6.8`

## 6.6.7

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.6.7`

## 6.6.6

### Patch Changes

- 🐛 **修复 wevu 与 weapp-vite 在 `v-for` 场景下内联事件对象参数的响应式丢失问题：`@tap="updateQuantity(item, -1)"` 传入的 `item` 会恢复为源列表引用，方法内直接修改对象字段可正确触发视图更新。同时补齐 patch 模式下对 ref/reactive 子根变更的调度与回退映射，避免事件逻辑执行但 UI 不刷新的情况。** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903) by @sonofmagic
- 📦 **Dependencies** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903)
  → `@wevu/compiler@6.6.6`

## 6.6.5

### Patch Changes

- 🐛 **修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d) by @sonofmagic
  - 同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。
- 📦 **Dependencies** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d)
  → `@wevu/compiler@6.6.5`

## 6.6.4

### Patch Changes

- 🐛 **fix(wevu)：修复 store `direct` 通知在订阅回调内二次修改状态时可能出现的重入更新风暴问题，避免小程序模拟器长时间无响应；同时补充 `wevu-features` 的 `use-store` 能力展示与对应 e2e 回归覆盖，提升交互稳定性与可验证性。** [`8d2d7f7`](https://github.com/weapp-vite/weapp-vite/commit/8d2d7f7e72d3da5a10fa14e5b66370f739eaf752) by @sonofmagic

- 🐛 **docs(wevu)：补充 wevu 特性展示与 e2e 覆盖，并明确 `useAttrs`、`useSlots`、`defineSlots` 在小程序平台的兼容边界与使用建议。** [`05e5517`](https://github.com/weapp-vite/weapp-vite/commit/05e55174e73c93c69bc28f6d651841161697a425) by @sonofmagic

- 🐛 **fix(wevu)：修复组件 attrs 同步会混入运行时 state 字段的问题，避免 attrs 透传被内部字段污染；同时将 runtime e2e 页面中的 `<text selectable>` 调整为 `user-select` 以消除平台弃用告警。** [`8916fc1`](https://github.com/weapp-vite/weapp-vite/commit/8916fc121800ad0da417cfe1e584b33d20094cc7) by @sonofmagic

- 🐛 **fix(wevu)：修复 runtime watch 停止句柄与注册流程的类型不一致问题，清理小程序全局对象与生命周期补丁的 TS 报错，并补全对外 API 的 tsd 与导出覆盖测试。** [`3af0847`](https://github.com/weapp-vite/weapp-vite/commit/3af0847c326a374cddd1bed283a1f24c4a2358ba) by @sonofmagic
- 📦 **Dependencies** [`5aae454`](https://github.com/weapp-vite/weapp-vite/commit/5aae454c219bbbb5f0ef206f63c9a7d6d42c8248)
  → `@wevu/compiler@6.6.4`

## 6.6.3

### Patch Changes

- 🐛 **修复 issue #294：当页面默认导出为 `Object.assign(...)` 形态时，`onShareAppMessage` / `onShareTimeline` 在编译阶段未正确注入页面 `features` 的问题。** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a) by @sonofmagic
  本次修复统一了 Vue 脚本重写与页面特性扫描对 `Object.assign` 选项对象的识别逻辑，确保 share hooks 能稳定注入：
  - `enableOnShareAppMessage`
  - `enableOnShareTimeline`

  同时新增对应单元测试，并在 `e2e-apps/github-issues` 中增加 `issue-294` 页面与 e2e 断言，覆盖真实构建产物验证。

- 📦 **Dependencies** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a)
  → `@wevu/compiler@6.6.3`

## 2.1.11

### Patch Changes

- 📦 **Dependencies** [`4ea5edc`](https://github.com/weapp-vite/weapp-vite/commit/4ea5edc17db281bf3167620906d1a27f91be3a1a)
  → `@wevu/compiler@0.1.2`

## 2.1.10

### Patch Changes

- 📦 **Dependencies** [`2be2749`](https://github.com/weapp-vite/weapp-vite/commit/2be27498a498fb1e85c5533cc521eb42bdad2ba8)
  → `@wevu/compiler@0.1.1`

## 2.1.9

### Patch Changes

- 📦 **Dependencies** [`65f9f13`](https://github.com/weapp-vite/weapp-vite/commit/65f9f131549181dcb23ac3f2767970663bd6c3c7)
  → `@wevu/compiler@0.1.0`

## 2.1.8

### Patch Changes

- 🐛 **fix: 修复 WeappIntrinsicElements 属性合并导致 `id` 推断为 `undefined` 的问题。** [`24f4d06`](https://github.com/weapp-vite/weapp-vite/commit/24f4d06d09986d48a56660d04481e44bb68afe5a) by @sonofmagic
  - 生成器跳过与基础属性（`id/class/style/hidden`）同名的组件属性，避免交叉类型冲突。
  - 基础属性 `id` 调整为 `string | number`，使 `map` 等场景可同时接收字符串与数字。
  - 补充 `tsd` 回归测试，验证 `WeappIntrinsicElements['map']['id']` 为 `string | number | undefined`。
- 📦 **Dependencies** [`eef1eec`](https://github.com/weapp-vite/weapp-vite/commit/eef1eec1a5d73feaa8e82a74ebf4b5d7270159aa)
  → `@wevu/compiler@0.0.7`

## 2.1.7

### Patch Changes

- 🐛 **fix: 修复 class/style helper 在微信与支付宝脚本模块语法差异下的兼容回归。** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6) by @sonofmagic
  - `@wevu/compiler` 的 class/style helper 改为按脚本扩展名分支生成：
    - `.wxs` 保持 `module.exports`、`Array.isArray` 与 `String.fromCharCode` 路径，恢复微信端行为。
    - `.sjs` 继续使用 `export default`，并避免 `Array` / `String.fromCharCode` 等在支付宝 SJS 下受限的标识符。
  - `weapp-vite` 补充对应单测断言，分别覆盖 `wxs` 与 `sjs` helper 输出约束。
  - 在 `e2e-apps/wevu-runtime-e2e` 新增 `pages/class-style/index.vue`，补充 class/style 多形态绑定示例，并同步 `weapp/alipay/tt` e2e 快照，防止后续回归。

- 🐛 **fix(alipay): 避免运行时直接访问 `globalThis` 导致支付宝端报错。** [`aabec69`](https://github.com/weapp-vite/weapp-vite/commit/aabec69b7e543d092113b377af1a552d623553e5) by @sonofmagic
  - wevu 运行时在自动注册 App、页面生命周期补丁与 scoped-slot 全局注入场景，改为优先使用小程序全局对象（`wx`/`my`），避免在关键路径直接访问 `globalThis`。
  - 修复支付宝模拟器中 `ReferenceError: globalThis is not defined`，兼容不提供 `globalThis` 的运行环境。
- 📦 **Dependencies** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6)
  → `@wevu/compiler@0.0.6`

## 2.1.6

### Patch Changes

- 🐛 **lib 模式默认生成 dts，支持 .vue/wevu SFC，并修复 rolldown dts 输出命名冲突；新增 internal 模式生成 Vue SFC dts（vue-tsc 作为可选后备），同时导出 WevuComponentConstructor 以保障声明生成。** [`7ac4a68`](https://github.com/weapp-vite/weapp-vite/commit/7ac4a688e88e21192cf0806ca041db0773ac3506) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@0.0.5`

## 2.1.5

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@wevu/compiler@0.0.4`

## 2.1.4

### Patch Changes

- 📦 **Dependencies** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628)
  → `@wevu/compiler@0.0.3`

## 2.1.3

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@0.0.2`

## 2.1.2

### Patch Changes

- 🐛 **将 Vue SFC 与 wevu 编译逻辑迁移到 `@wevu/compiler`，由 `wevu/compiler` 统一导出，`weapp-vite` 改为使用新编译器入口并清理重复实现。** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce) by @sonofmagic

- 🐛 **为 wevu 的 watch/watchEffect 增加 pause 与 resume 能力，同时保持 stop 旧用法兼容。** [`d54d430`](https://github.com/weapp-vite/weapp-vite/commit/d54d430a93b8045f91ab1a16b2501dceda10a824) by @sonofmagic

- 🐛 **修复 watch/watchEffect 在同一微任务内重复触发的问题，确保调度去重生效。** [`7fc02cd`](https://github.com/weapp-vite/weapp-vite/commit/7fc02cd1fb7858358445b07bfd24f443b1a99ad3) by @sonofmagic
- 📦 **Dependencies** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce)
  → `@wevu/compiler@0.0.1`

## 2.1.1

### Patch Changes

- 🐛 **支持内联事件参数使用动态表达式，并兼容小程序侧数组参数传递。** [`8940c7f`](https://github.com/weapp-vite/weapp-vite/commit/8940c7fd87b6153137ca9b33b8d0925a4b592c4e) by @sonofmagic

- 🐛 **支持内联事件表达式在编译期生成执行器，保证复杂参数调用在小程序运行时可用。** [`9c90f7b`](https://github.com/weapp-vite/weapp-vite/commit/9c90f7b6777374aaf54ee4b5955a4b01209acc0f) by @sonofmagic

- 🐛 **修复内联事件表达式执行器在运行时读取不到 inline map 的问题，确保模板事件可正常触发。** [`fc5657e`](https://github.com/weapp-vite/weapp-vite/commit/fc5657e7c66c4150aba47829b48f5d38f797d797) by @sonofmagic

- 🐛 **修复组件化页面生命周期补触发逻辑，补齐下拉刷新/滚动事件，并避免生命周期日志丢失。** [`26bc05b`](https://github.com/weapp-vite/weapp-vite/commit/26bc05b47852aaf07c45e7528c60269dc36d1d9b) by @sonofmagic

## 2.1.0

### Minor Changes

- ✨ **新增组件选项 `setupLifecycle`（`created` / `attached`），并将默认执行时机改为 `attached`，以便 setup 拿到外部传入的 props；同时 weapp-vite 类型对齐该配置。** [`5c42bd3`](https://github.com/weapp-vite/weapp-vite/commit/5c42bd34cac020dc6d6bd094b6b45e78cdb6a53c) by @sonofmagic

## 2.0.2

### Patch Changes

- 🐛 **补全 button 的 open-type 枚举与事件类型，并补充单元测试和 tsd 覆盖。** [`a6e3ba8`](https://github.com/weapp-vite/weapp-vite/commit/a6e3ba8be6c22dcfbf2edbfa9c977f8a39aef119) by @sonofmagic

- 🐛 **按组件拆分 weappIntrinsicElements 输出文件，并为每个组件文件补充文档链接注释。** [`d160032`](https://github.com/weapp-vite/weapp-vite/commit/d16003262a212070f1547db80ab2b7f7aecb8a83) by @sonofmagic

## 2.0.1

### Patch Changes

- 🐛 **对齐 `watch`/`watchEffect` 的 `flush`/`scheduler`/`once`/`deep:number` 行为与类型，并补充 `traverse` 分支覆盖；修复 rolldown-require 的类型构建错误。** [`28ea55d`](https://github.com/weapp-vite/weapp-vite/commit/28ea55d72429fd416502d80fa9819c099fe16dd3) by @sonofmagic

## 2.0.0

### Major Changes

- 🚀 **破坏性变更：`setup` 与 Vue 3 对齐，仅支持 `setup(props, ctx)`。请将 `setup(ctx)` 改为 `setup(_, ctx)`。** [`158306b`](https://github.com/weapp-vite/weapp-vite/commit/158306b75191040ecbdef846e66e9f6e49036d19) by @sonofmagic

## 1.3.0

### Minor Changes

- ✨ **新增 `toValue` 与 `MaybeRef`/`MaybeRefOrGetter` 类型对齐 Vue API，补充 tsd 与运行时测试覆盖常见场景。** [`ecf7436`](https://github.com/weapp-vite/weapp-vite/commit/ecf7436d8c22a4827cbb26410eb6153156cfc796) by @sonofmagic

### Patch Changes

- 🐛 **修复 defineComponent 类型在 TypeScript 中的深度实例化问题，并补充 \_\_typeProps 与实例 $props 的类型测试覆盖。** [`705b087`](https://github.com/weapp-vite/weapp-vite/commit/705b087e36a30655a6786597d63c71bce93a1684) by @sonofmagic

## 1.2.1

### Patch Changes

- 🐛 **Miscellaneous improvements** [`775e89d`](https://github.com/weapp-vite/weapp-vite/commit/775e89d64484bc3052204c1ed73a9549d7359093) by @sonofmagic
  - store `$subscribe` 支持直接赋值触发，新增 `mutation.type = direct`。
  - store `$reset` 现在支持 Setup Store，并重置为初始快照。

## 1.2.0

### Minor Changes

- ✨ **简化 wevu 类型构建流程，改用 tsdown 生成声明文件，并补充 vue 依赖。** [`e592907`](https://github.com/weapp-vite/weapp-vite/commit/e59290771ae1f152b421b10e5960d486023ccbb6) by @sonofmagic

## 1.1.4

### Patch Changes

- 🐛 **修复 wevu 无 Vue 依赖时的类型入口，补齐 DefineComponent 默认 props 推导与 ComponentPublicInstance 形态，确保 Volar 能正确解析 SFC props。** [`ff5930b`](https://github.com/weapp-vite/weapp-vite/commit/ff5930b162f79436e74430f2820fa3b7e27a4eed) by @sonofmagic

## 1.1.3

### Patch Changes

- 🐛 **修复类型导出与内联逻辑，确保 wevu 类型文件不再依赖外部 `@vue/*` 包，并补齐 `DefineComponent` 等类型的泛型签名。** [`10ae1ea`](https://github.com/weapp-vite/weapp-vite/commit/10ae1eaa25d4b64f028a0c2eccb8487d19aed5ef) by @sonofmagic

## 1.1.2

### Patch Changes

- 🐛 **修复组件模板 ref 返回值，优先返回 expose/公开实例并自动识别组件 ref。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **新增 useTemplateRef 支持并同步模板 ref 更新逻辑。** [`5eed670`](https://github.com/weapp-vite/weapp-vite/commit/5eed670c559d9d8fd5a5a3f3c963a3e08be75559) by @sonofmagic

- 🐛 **组件模板 ref 同时返回节点查询能力与 expose 成员，避免 ref 丢失 DOM 查询方法。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **调整 onMounted/onReady 触发时机，确保模板 ref 更新完成后再执行。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **修复 defineComponent 类型推导，使组件 ref 能拿到 defineExpose 暴露的实例类型。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

## 1.1.1

### Patch Changes

- 🐛 **新增 Vue SFC 模板 ref 支持，编译期注入 ref 元数据与标记，运行时通过 selectorQuery 绑定与更新。** [`60f19f8`](https://github.com/weapp-vite/weapp-vite/commit/60f19f8bceff0ffdd8668e54b00f6864999e4c5a) by @sonofmagic

## 1.1.0

### Minor Changes

- ✨ **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 1.0.7

### Patch Changes

- 🐛 **将 `<script setup>` 宏类型声明迁移到 `macros.ts`，`index.ts` 仅保留导出结构。** [`be9cdec`](https://github.com/weapp-vite/weapp-vite/commit/be9cdece9b680178b8f1e57d0b945251c9c4fe82) by @sonofmagic

## 1.0.6

### Patch Changes

- 🐛 **修复 watch 对数组源的类型推断，使其与 Vue 3 行为对齐，并完善 useBindModel 在模板中的推荐用法。** [`dc9fcc0`](https://github.com/weapp-vite/weapp-vite/commit/dc9fcc044af51c4d39439064717864f51a1f7aad) by @sonofmagic

## 1.0.5

### Patch Changes

- 🐛 **补齐 class/style 绑定对象/数组在小程序中的 WXS/JS 运行时支持，JS 侧改为编译期 AST 注入以避免 eval/with，并新增相关单测覆盖。** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74) by @sonofmagic

- 🐛 **为 WXML 基础属性补充 `id`、`class`、`style`、`hidden` 的 JSX 提示。** [`10aa821`](https://github.com/weapp-vite/weapp-vite/commit/10aa821610e49c4a785446af162ad837cc905926) by @sonofmagic

- 🐛 **补充内置小程序 JSX 属性类型：class/style 对齐 Vue 语义，并支持 `data-*` dataset 声明。** [`eafbe3e`](https://github.com/weapp-vite/weapp-vite/commit/eafbe3ecfc325dc7fd910ee7e353e0a3cfcf3801) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **docs: 补充 wevu 宏指令中文注释与用法示例** [`fcb8d6a`](https://github.com/weapp-vite/weapp-vite/commit/fcb8d6a13e501880cc976409f372518002f3229e) by @sonofmagic

- 🐛 **修复 autoImportComponents 生成的导航路径优先指向 `.d.ts`，避免组件类型在 Volar 中退化为 `any`。** [`fe23c0e`](https://github.com/weapp-vite/weapp-vite/commit/fe23c0e2f191f3b7b2043cd3e30afe07c0b7df69) by @sonofmagic
  - 补充 wevu 宏指令的中文说明与示例，完善类型提示使用说明。 调整 wevu `jsx-runtime` 的 `IntrinsicElements` 以继承 `GlobalComponents`，让小程序组件标签能正确推断属性类型。

## 1.0.3

### Patch Changes

- 🐛 **修复响应式相关问题：** [`4f5b4d4`](https://github.com/weapp-vite/weapp-vite/commit/4f5b4d43b0a604f901b27eb143b2a63ed7049f11) by @sonofmagic
  - `triggerEffects` 迭代时复制依赖集合，避免自触发死循环
  - `triggerRef` 直接触发依赖，确保在值不变时也能更新
  - `watch` 监听 reactive 源时默认走 deep 策略，保持行为一致

## 1.0.2

### Patch Changes

- 🐛 **性能：调度器避免同一 tick 内重复安排 flush；diff 避免递归创建 key set，减少 GC 压力。** [`29d8996`](https://github.com/weapp-vite/weapp-vite/commit/29d899694f0166ffce5d93b8c278ab53d86ced1e) by @sonofmagic
  - 优化：支持通过 `setData` 选项控制快照字段与是否包含 computed，降低 setData 体积与快照开销。
  - 优化：新增 `setData.strategy = "patch"`，按变更路径增量生成 setData payload（在共享引用等场景会自动回退到 diff）。
  - 优化：patch 模式预先建立对象路径索引，减少“路径未知导致回退 diff”的概率；数组内部对象变更会回退到数组整体替换。
  - 优化：patch 模式会合并冗余变更路径（当父路径存在时丢弃子路径），进一步减少 setData payload。
  - 优化：patch 模式对 computed 做“脏 key 收集”，只对变更的 computed 计算与下发，降低开销。
  - 优化：patch 模式支持 `maxPatchKeys/maxPayloadBytes` 阈值，变更路径或 payload 过大时自动回退到 diff。
  - 优化：patch 模式支持 `mergeSiblingThreshold`，当同一父路径下出现多个子路径变更时合并为父路径下发，进一步减少 keys 数与调度开销。
  - 优化：patch 模式优化 `collapsePayload` 与 payload 大小估算，减少不必要的字符串化与分配开销。
  - 优化：patch 模式 computed 下发逻辑优化，减少不必要的 diff 计算与对象分配。
  - 优化：patch 模式支持通过 `computedCompare/computedCompareMaxDepth/computedCompareMaxKeys` 控制 computed 对比开销，避免大对象递归比较过慢。
  - 优化：卸载时清理 patch 模式的内部路径索引，降低长期运行内存占用与索引维护成本。
  - 优化：`collapsePayload` 使用排序 + 前缀栈扫描替代逐层 ancestor 查找，减少路径去重开销。
  - 优化：patch 模式支持 `debug` 回调输出回退原因与 key 数，便于调参与定位性能瓶颈。
  - 优化：patch 模式支持 `prelinkMaxDepth/prelinkMaxKeys` 限制预链接开销，避免大 state 初始化卡顿。
  - 优化：同级合并支持 `mergeSiblingMaxInflationRatio/mergeSiblingMaxParentBytes/mergeSiblingSkipArray`，减少“合并反而变大”的负优化。
  - 优化：共享引用等“路径不唯一”场景下，patch 模式尝试回退到受影响的顶层字段整体替换，避免直接全量 diff。
  - 优化：提供 `markNoSetData()` 用于标记值跳过 setData 序列化，提升大对象/SDK 实例的使用体验。
  - 优化：`toPlain` 对 Date/Map/Set/RegExp/Error/ArrayBuffer 等值做宽松序列化，减少不可序列化导致的问题。
  - 修复：`onErrorCaptured` 回调的 instance 参数稳定指向注册时实例。
  - 重构：提炼 `setComputedValue` / `parseModelEventValue` 内部复用函数。

## 1.0.1

### Patch Changes

- 🐛 **移除 `onAppShow/onAppHide/onAppError/onAppLaunch` 等 `onApp*` hooks，App 生命周期统一使用：** [`6f1c4ca`](https://github.com/weapp-vite/weapp-vite/commit/6f1c4cabb30a03f0dc51b11c3aff6fdcbf0e09c9) by @sonofmagic
  - `onLaunch/onShow/onHide/onError/onPageNotFound/onUnhandledRejection/onThemeChange`。
  - 同时将 `onErrorCaptured` 的映射调整为 `onError`。

## 1.0.0

### Major Changes

- 🚀 **## fix-nonserializable-setup-return** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  修复 `setup` 返回非可序列化对象导致小程序端更新栈溢出的问题：
  - 当 `setup/script setup` 返回值中包含小程序实例等复杂对象时，运行时不再将其纳入 `setData` 快照（改为非枚举属性，仅供 JS 侧访问），避免序列化/遍历时出现 `Maximum call stack size exceeded`。

  ## fix-setup-ref-ui-update

  修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

  ## fix-vmodel-and-props-sync-zh

  修复 weapp-vite + wevu 在微信小程序中的两类常见问题：
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

  ## support-script-setup-model-slots

  补齐 Vue `<script setup>` 宏与运行时兼容能力：
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。

  ## unify-wevu-entry

  Store API 统一从主入口导出，并补充 wevu 使用文档与案例合集。

  ## wevu-page-hooks-mapping

  补齐 Page 页面事件 hooks，并增强 `features` 用途：
  - `features` 用于**按需注入**页面事件处理函数（仍保持默认不注入，避免无效事件派发带来的性能与 UI 影响）。当你只在 `setup()` 里注册 hook 时，可通过 `features` 显式开启对应页面事件（例如 `onShareTimeline` 需要在注册阶段存在才会展示菜单按钮）。
  - 新增页面 hooks：`onLoad`、`onPullDownRefresh`、`onReachBottom`。
  - 新增文档 `docs/wevu/page-hooks-mapping.md`，提供 wevu hooks 与原生 Page 生命周期/事件回调的 1:1 对应表。

  ## wevu-reactivity-batch-scope

  新增响应式批处理与作用域能力：
  - 新增 `batch`/`startBatch`/`endBatch`，支持将同一同步批次内的多次状态变更合并触发，减少重复 effect 执行。
  - 新增 `effectScope`/`onScopeDispose`/`getCurrentScope`，并让 `watch`/`watchEffect` 自动注册到作用域中，便于统一销毁与避免内存泄漏。
  - 修复 `watchEffect` 初始化时可能重复执行的问题（现在仅执行一次以建立依赖）。

  ## wevu-tsd-store-typing

  完善 wevu store 的类型推导对齐 Pinia，并补齐 tsd 测试覆盖。

  ## zh-auto-wevu-page-features

  weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

  ## zh-improve-wevu-notes

  完善 wevu 运行时的健壮性与中文注释：补齐 runtime methods/state 兜底避免空指针，同时为响应式、生命周期、store 等源码补充详细中文说明，方便阅读和调试。

  ## zh-slot-template-blocks-and-multiple-slots

  优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

  ## zh-wevu-component-lifetimes-hooks

  补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：
  - wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
  - 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

  ## zh-wevu-component-only-pages

  wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

## 1.0.0-alpha.5

### Patch Changes

- 🐛 **修复 weapp-vite + wevu 在微信小程序中的两类常见问题：** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9) by @sonofmagic
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

## 1.0.0-alpha.4

### Patch Changes

- 🐛 **补齐 Vue `<script setup>` 宏与运行时兼容能力：** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472) by @sonofmagic
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。

## 1.0.0-alpha.3

### Minor Changes

- [`32b44ae`](https://github.com/weapp-vite/weapp-vite/commit/32b44aef543b981f74389ee23e8ae2b7d4ecd2af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 补齐 Page 页面事件 hooks，并增强 `features` 用途：
  - `features` 用于**按需注入**页面事件处理函数（仍保持默认不注入，避免无效事件派发带来的性能与 UI 影响）。当你只在 `setup()` 里注册 hook 时，可通过 `features` 显式开启对应页面事件（例如 `onShareTimeline` 需要在注册阶段存在才会展示菜单按钮）。
  - 新增页面 hooks：`onLoad`、`onPullDownRefresh`、`onReachBottom`。
  - 新增文档 `docs/wevu/page-hooks-mapping.md`，提供 wevu hooks 与原生 Page 生命周期/事件回调的 1:1 对应表。

### Patch Changes

- [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

- [`7af6104`](https://github.com/weapp-vite/weapp-vite/commit/7af6104c5a4ddec0808f7336766adadae3c3801e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：
  - wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
  - 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

## 1.0.0-alpha.2

### Minor Changes

- [`96a5161`](https://github.com/weapp-vite/weapp-vite/commit/96a516176d98344b4c1d5d9b70504b0032d138c9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增响应式批处理与作用域能力：
  - 新增 `batch`/`startBatch`/`endBatch`，支持将同一同步批次内的多次状态变更合并触发，减少重复 effect 执行。
  - 新增 `effectScope`/`onScopeDispose`/`getCurrentScope`，并让 `watch`/`watchEffect` 自动注册到作用域中，便于统一销毁与避免内存泄漏。
  - 修复 `watchEffect` 初始化时可能重复执行的问题（现在仅执行一次以建立依赖）。

### Patch Changes

- [`e2fdc64`](https://github.com/weapp-vite/weapp-vite/commit/e2fdc643dc7224f398b4a21e2d3f55dec310dd8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 `setup` 返回非可序列化对象导致小程序端更新栈溢出的问题：
  - 当 `setup/script setup` 返回值中包含小程序实例等复杂对象时，运行时不再将其纳入 `setData` 快照（改为非枚举属性，仅供 JS 侧访问），避免序列化/遍历时出现 `Maximum call stack size exceeded`。

- [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

## 1.0.0-alpha.1

### Major Changes

- [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

### Patch Changes

- [`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

## 0.0.2-alpha.0

### Patch Changes

- [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完善 wevu store 的类型推导对齐 Pinia，并补齐 tsd 测试覆盖。

- [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完善 wevu 运行时的健壮性与中文注释：补齐 runtime methods/state 兜底避免空指针，同时为响应式、生命周期、store 等源码补充详细中文说明，方便阅读和调试。

## 0.0.1

### Patch Changes

- [`d48b954`](https://github.com/weapp-vite/weapp-vite/commit/d48b954569142923b8956e75c344edcbdc020ad7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 运行时现在在调用 `createApp/defineComponent` 时直接注册原生实例，同时补充文档与示例说明新的无感挂载方式。
