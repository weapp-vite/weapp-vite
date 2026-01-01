---
"wevu": major
---

## fix-nonserializable-setup-return

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
