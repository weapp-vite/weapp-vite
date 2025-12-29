---
title: 运行时与生命周期
---

# 运行时与生命周期

wevu 运行时的核心职责是：

- 把 `data/computed/methods/setup/watch` 等选项桥接到小程序 `Component() / App()`；
- 将 state + computed 生成快照（plain object），diff 后只下发变化路径到 `setData()`；
- 提供生命周期钩子与 `bindModel()` 等小程序友好能力。

:::tip 导入约定
所有 API 都从 `wevu` 主入口导入。
:::

## defineComponent：注册页面/组件

`defineComponent(options)` 会直接调用全局 `Component()` 完成注册（页面和组件都走 `Component()`，这是 wevu 的统一模型）。

```ts
import { defineComponent, onShow, ref } from 'wevu'

export default defineComponent({
  // 仅页面生效：声明需要开启的页面能力（不声明则不会桥接对应生命周期）
  features: { listenPageScroll: true, enableShareAppMessage: true },

  // 原生小程序字段保持原样（properties、options、lifetimes、pageLifetimes...）
  properties: { initial: { type: Number, value: 0 } },

  setup(props) {
    const count = ref(props.initial ?? 0)
    onShow(() => console.log('show'))
    return { count, inc: () => count.value++ }
  },
})
```

:::warning 运行环境
`defineComponent()` 依赖小程序运行时提供的全局 `Component()`；在 Node/Vitest 等环境运行时请自行 stub。
:::

### props / properties

wevu 同时支持两种 props 定义方式：

- 小程序原生 `properties`：完全按小程序规范书写，`setup(props, ctx)` 通过 `props`/`ctx.props` 读取。
- Vue 风格 `props`：会被转换为小程序 `properties`（支持 `type` 与 `default` / `value`）。

如果你使用 weapp-vite 的 SFC 编译产物，通常会走 `createWevuComponent(options)`（见下节），并直接携带小程序 `properties`。

### createWevuComponent（供编译产物调用）

`createWevuComponent(options)` 是 `defineComponent()` 的兼容入口，主要用于 weapp-vite 生成的组件代码调用；它会保留小程序 `properties` 定义并完成组件注册。

## setup：签名与上下文

`setup` 支持两种签名：

- `setup(ctx)`
- `setup(props, ctx)`

其中 `props` / `ctx.props` 来自小程序实例的 `properties`（页面通常为空对象）。

`ctx`（关键字段）：

- `ctx.runtime`：运行时实例（暴露 `bindModel` / `watch` / `snapshot` / `unmount` 等）
- `ctx.state`：响应式 state（包含 `data()` 与 `setup()` 返回的非函数值）
- `ctx.proxy`：公开实例代理（也是 `methods/computed` 的 `this`）
- `ctx.emit(event, ...args)`：触发自定义事件（内部调用 `triggerEvent`）
- `ctx.bindModel(path, options?)`：创建模型绑定（见下文）
- `ctx.watch(source, cb, options?)`：等价于 `ctx.runtime.watch`
- `ctx.instance`：小程序原生实例（高级/调试用途）

:::warning 同步调用约束
生命周期钩子必须在 `setup()` **同步执行阶段**调用，否则会抛错。
:::

## 生命周期钩子与 features

### 通用钩子（页面/组件）

- `onShow` / `onHide` / `onReady` / `onUnload`

### 组件钩子（来自 lifetimes/pageLifetimes）

- `onMoved`（`lifetimes.moved`）
- `onError`（`lifetimes.error`）
- `onResize`（`pageLifetimes.resize`）

### 页面钩子（需要显式开启 features）

- `features.listenPageScroll` → `onPageScroll`
- `features.enableShareAppMessage` → `onShareAppMessage`
- `features.enableShareTimeline` → `onShareTimeline`
- `features.enableAddToFavorites` → `onAddToFavorites`

此外还有两个通过 `lifetimes/pageLifetimes` 包装派发的钩子：

- `onRouteDone`
- `onTabItemTap`

### 返回值型钩子（单实例）

以下钩子按“单实例”注册（后注册覆盖先注册），并允许返回值：

- `onSaveExitState`
- `onShareAppMessage`
- `onShareTimeline`
- `onAddToFavorites`

### Vue 风格别名（语义对齐为主）

- `onMounted` → `onReady`
- `onUnmounted` → `onUnload`
- `onActivated` → `onShow`
- `onDeactivated` → `onHide`
- `onErrorCaptured` → `onAppError`
- `onBeforeMount` / `onBeforeUnmount`：在 `setup()` 同步阶段立即执行（小程序无精确对应时机）
- `onBeforeUpdate` / `onUpdated`：当前版本仅提供注册 API，尚未在 `setData` 前后自动派发

## bindModel：模型绑定

`ctx.bindModel(path, options?)` 返回一个 `ModelBinding`：

- `binding.value` / `binding.update(value)`：读取或更新目标路径
- `binding.model(modelOptions?)`：生成用于模板 `v-bind` 的字段（默认 `value` + `onInput`）

```ts
// setup(props, ctx) 内
const { model } = ctx.bindModel('form.price', {
  event: 'blur',
  formatter: v => Number(v) || 0,
})
```

```vue
<input v-bind="model()" />
```

默认解析器会优先取 `event.detail.value`，其次取 `event.target.value`；你也可以通过 `parser` 自定义解析逻辑。

## watch：组合式与选项式

### 组合式 watch

`watch()` / `watchEffect()` 与 Vue 3 类似，调度使用微任务队列；`deep` 默认采用“版本信号”策略（只订阅根版本号，不做深层遍历）：

```ts
import { setDeepWatchStrategy } from 'wevu'

setDeepWatchStrategy('traverse')
```

### 选项式 watch（defineComponent/watch）

`defineComponent({ watch: { 'a.b': descriptor } })` 支持点路径表达式与三种描述符：

- 函数：`watch: { count(n, o) {} }`
- 方法名：`watch: { count: 'onCountChange' }`
- 对象：`watch: { count: { handler: 'onCountChange', immediate: true, deep: true } }`

## Provide / Inject

- `provide(key, value)` / `inject(key, defaultValue?)`：优先读写“当前实例”的 provide 域，找不到会回落到全局存储
- `provideGlobal` / `injectGlobal`：显式的全局读写（组件外调用场景）

:::warning 重要限制
当前版本没有组件树父子指针，`inject()` 不会向上查找“祖先组件”；组件内注入只能命中“当前实例提供的值”，否则回落到全局存储。
:::

## createApp：应用运行时与插件

`createApp(options)` 创建运行时，并在检测到全局 `App()` 时自动完成应用注册；插件通过 `app.use()` 安装：

```ts
import { createApp } from 'wevu'

const app = createApp({ data: () => ({}) })
app.use((runtime) => {
  runtime.config.globalProperties.$log = (...args: any[]) => console.log(...args)
})
```

`app.config.globalProperties` 会注入到公开实例 `proxy`，可通过 `this.$log`（或 `ctx.proxy.$log`）访问。
