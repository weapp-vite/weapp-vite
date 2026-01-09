# wevu

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
