# @wevu/web-apis

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
