---
title: defineComponent（组件）
---

# defineComponent（组件）

`defineComponent()` 是原生 `Component()` 的超集：在组件 `lifetimes.created` 阶段初始化运行时并执行同步 `setup()`；`setup()` 返回对象会合并到组件实例，模板可直接使用。

> 注意：小程序在 `created` 阶段禁止调用 `setData`。因此 wevu 会在 `created` 阶段**缓冲**由响应式更新产生的 `setData`，并在首次安全时机（组件 `attached` / 页面 `onLoad`）再统一 flush。

## 页面也用 defineComponent（统一模型）

在 wevu 里，页面与组件都通过 `Component()` 注册，这是统一模型的一部分：

- 页面特有能力（滚动/分享/触底/下拉刷新等）通过 wevu 的页面 hooks 注册（详见 `/wevu/runtime`）。
- 小程序“按需派发”的页面事件，需要对应页面方法存在才会触发；配合 weapp-vite 构建时，通常由编译阶段自动补齐 `features.enableOnXxx`（详见 `/guide/vue-sfc`）。

## 原生 Component 选项在 wevu 的写法

结论先说：除了 `data / computed / methods / watch / setup / props` 这些由 wevu 接管的“增强选项”外，其余原生 `Component({ ... })` 的字段，都可以**直接写到** `defineComponent({ ... })` 里（wevu 会透传给原生 `Component()`）。

下面按你列出的字段逐项对照（类型定义可参考 `miniprogram-api-typings` 中的 `WechatMiniprogram.Component.*`）。

| 原生字段           | wevu 写法                                                                                                                         | 说明                                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `behaviors`        | `defineComponent({ behaviors: [...] })`                                                                                           | 原样透传给 `Component()`。                                                                                                                                                                                                               |
| `data`             | `defineComponent({ data: () => ({ ... }) })` 或 `setup()` return 非函数字段                                                       | wevu 推荐用函数返回初始数据；`setup()` 返回的非函数字段会进入运行时 state。                                                                                                                                                              |
| `methods`          | `defineComponent({ methods: { ... } })` 或 `setup()` return 函数                                                                  | `methods` 与 `setup()` 返回函数都会成为实例方法；同名时原生 `methods` 会在 wevu 包装后仍可执行（内部会先尝试运行 wevu 方法）。                                                                                                           |
| `definitionFilter` | `defineComponent({ definitionFilter(defFields, arr) { ... } })`                                                                   | 原生组件扩展能力，wevu 不改写，直接透传。                                                                                                                                                                                                |
| `export`           | `defineComponent({ export() { return ... } })` 或 `setup(_, { expose }) { expose({ ... }) }`                                      | 原生导出用于 `behavior: wx://component-export`：wevu 默认会把 `setup()` 里 `expose({ ... })` 的结果作为 `export()` 返回值，因此通常无需再手写 `export()`；若同时提供了 `export()`，会与 `expose()` 结果浅合并（`export()` 优先级更高）。 |
| `externalClasses`  | `defineComponent({ externalClasses: [...] })`                                                                                     | 原样透传。                                                                                                                                                                                                                               |
| `lifetimes`        | 推荐用 `setup()` + wevu hooks；也可写 `defineComponent({ lifetimes: { ... } })`                                                   | `lifetimes.ready/detached/moved/error` 会被 wevu 包装以派发对应 hook，但你的原生回调仍会被调用；`lifetimes.created` 用于执行 wevu 的 `setup()`，并会在后续首次安全时机（`attached/onLoad`）flush 缓冲的 `setData`。                      |
| `observers`        | 推荐用 `watch()`/`watchEffect()` 或 `defineComponent({ watch: { 'a.b': fn } })`；也可写 `defineComponent({ observers: { ... } })` | `observers` 是原生数据监听器（支持更复杂的表达式/通配），wevu 不改写，直接透传；wevu 的 `watch` 是基于运行时代理的路径监听（更像 Vue 的 `watch` 选项）。                                                                                 |
| `options`          | `defineComponent({ options: { ... } })`                                                                                           | 原生 `ComponentOptions`（`multipleSlots/styleIsolation/pureDataPattern/virtualHost/...`）。注意：wevu 默认会把 `options.multipleSlots` 置为 `true`（用户显式传入则以用户为准）。                                                         |
| `pageLifetimes`    | 推荐用 `onShow/onHide/onResize`；也可写 `defineComponent({ pageLifetimes: { ... } })`                                             | `show/hide/resize` 会被 wevu 包装以派发 hook；其他字段按原生透传执行。                                                                                                                                                                   |
| `properties`       | 推荐：`props`；也可：`defineComponent({ properties: { ... } })`                                                                   | `props` 会被 wevu 规范化为原生 `properties`；如果同时传了 `props` 与 `properties`，以 `props` 生成的 `properties` 为准。                                                                                                                 |
| `relations`        | `defineComponent({ relations: { ... } })`                                                                                         | 原样透传。                                                                                                                                                                                                                               |

> 小提示：如果你在 wevu 里需要使用“原生 this”（例如访问 `this.setData`、`this.triggerEvent`、`selectComponent` 等），可以在 `setup(props, ctx)` 里通过 `ctx.instance` 访问小程序实例。

## lifetimes / pageLifetimes 对应的 hooks

> 说明：wevu 的 `onXXX()` 必须在 `setup()` **同步阶段**注册；由于 wevu 会在 `lifetimes.created` 内执行 `setup()`，因此你可以在 `setup()` 里注册所有 wevu hooks（包括 `onBeforeMount` 等）。

### lifetimes（组件生命周期）

| 小程序字段           | 回调名     | 对应 wevu hook             | 说明                                                                           |
| -------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------------ |
| `lifetimes.created`  | `created`  | `setup()`                  | wevu 在此阶段 mount 并执行 `setup()`（`setData` 会被延迟到 `attached/onLoad`） |
| `lifetimes.attached` | `attached` | -                          | 组件进入节点树；wevu 会在此阶段 flush `created` 阶段缓冲的 `setData`           |
| `lifetimes.ready`    | `ready`    | `onReady` / `onMounted`    | 组件就绪（内部做了重复触发去重）                                               |
| `lifetimes.moved`    | `moved`    | `onMoved`                  | 组件移动（例如在节点树中被移动）                                               |
| `lifetimes.detached` | `detached` | `onUnload` / `onUnmounted` | detached 时 teardown，并触发 `onUnload`                                        |
| `lifetimes.error`    | `error`    | `onError`                  | 组件错误（参数透传原生回调）                                                   |

### pageLifetimes（页面对组件的影响）

| 小程序字段             | 回调名   | 对应 wevu hook             | 说明                                 |
| ---------------------- | -------- | -------------------------- | ------------------------------------ |
| `pageLifetimes.show`   | `show`   | `onShow` / `onActivated`   | 所在页面显示                         |
| `pageLifetimes.hide`   | `hide`   | `onHide` / `onDeactivated` | 所在页面隐藏                         |
| `pageLifetimes.resize` | `resize` | `onResize`                 | 所在页面尺寸变化（参数透传原生回调） |
