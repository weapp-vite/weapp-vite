# @weapp-core/constants

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
