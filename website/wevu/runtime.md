---
title: 运行时与生命周期
---

# 运行时与生命周期

wevu 保持小程序原生模型，同时暴露类似 Vue 3 的组合式 API、生命周期和 v-model 绑定工具。

## API 速查

- `definePage(options, features?)`：注册页面，`features` 支持 `listenPageScroll`、`enableShareAppMessage`、`enableShareTimeline`、`enableAddToFavorites`。
- `defineComponent(options)`：注册组件；`properties` 仍按小程序规则声明。
- `createApp(options)`：创建小程序应用运行时，若存在全局 `App` 构造函数会自动注册；提供 `app.use(plugin)`、`app.config.globalProperties`。
- `createWevuComponent(options)`：供 weapp-vite SFC 编译产物调用，等价于 `defineComponent`。
- 生命周期钩子：`onShow`、`onHide`、`onReady`、`onUnload`、`onPageScroll`、`onRouteDone`、`onTabItemTap`，分享/收藏相关钩子，以及 Vue 风格别名 `onMounted`、`onUpdated`、`onBeforeUpdate`、`onUnmounted`、`onBeforeMount`。
- 组合式：`ref`、`reactive`、`computed`、`watch`、`watchEffect`、`readonly`、`provide`/`inject`、`getCurrentInstance`、`nextTick` 等均从 `wevu` 主入口导入。

## 页面与组件注册

```ts
import { defineComponent, definePage, onShow, ref } from 'wevu'

export const Counter = defineComponent({
  properties: { initial: { type: Number, value: 0 } },
  setup(ctx) {
    const count = ref(ctx.props.initial ?? 0)
    onShow(() => console.log('component show'))
    return { count, inc: () => count.value++ }
  },
})

// 页面附加特性通过第二个参数开启
export default definePage(
  { setup: () => ({}) },
  { listenPageScroll: true, enableShareAppMessage: true },
)
```

- `definePage`/`defineComponent` 会直接调用全局 `Page`/`Component` 进行注册，无需额外的 `createApp().mount()`。
- `features` 只作用于页面。
- `properties`、`usingComponents` 等小程序字段保持原生格式。

## setup 上下文与生命周期

- `ctx.props`：小程序 `properties` 数据；`ctx.emit(event, ...)` 触发自定义事件。
- `ctx.runtime/state/proxy`：运行时实例与响应式状态；`proxy` 同时暴露 `methods` 与 `computed`。
- `ctx.bindModel(path, options?)`：创建 v-model 绑定（见下文）。
- `ctx.watch(source, cb, options?)`：等价于 `runtime.watch`，支持 `immediate`、`deep`。
- `ctx.instance`：小程序原生实例；`ctx.expose()` 可挂载自定义暴露对象。
- 生命周期钩子必须在 `setup()` 内同步调用。
- 支持的生命周期映射：
  - 页面/组件：`onShow`、`onHide`、`onReady`、`onUnload`
  - 页面：`onPageScroll`、`onRouteDone`、`onTabItemTap`、`onShareAppMessage`、`onShareTimeline`、`onAddToFavorites`
  - Vue 风格：`onMounted` → `onReady`，`onUpdated` → 每次 `setData` 完成，`onBeforeUpdate` → `setData` 前，`onBeforeMount` 同步调用，`onUnmounted` → 页面卸载或组件 detached

## 模型绑定（bindModel）

`bindModel(path)` 生成一套用于小程序事件的绑定对象，内置解析 `event.detail.value`/`event.target.value`，也可自定义事件名和格式化：

```ts
// 在 setup(ctx) 内
const amount = ref(1)
const { model } = ctx.bindModel('amount')

const { model: priceModel } = ctx.bindModel('form.price', {
  event: 'blur',
  formatter: v => Number(v) || 0,
})
```

```vue
<input v-bind="model()" />

<input v-bind="priceModel({ parser: e => Number(e.detail?.value) })" />
```

## Watch 与响应式

- `watch(source, cb, { immediate, deep })`、`watchEffect(cb)` 与 Vue 3 类似。
- 深度 watch 默认使用“版本信号”策略，可通过 `setDeepWatchStrategy('traverse')` 强制逐层遍历非响应式对象。
- `nextTick()` 使用微任务批量调度，`setData` 仅发送 diff 后的最小变更集。

## Provide / Inject

- `provide(key, value)` / `inject(key, defaultValue?)` 可在 `setup` 内使用；当前实例无匹配时会退回到全局存储。
- `provideGlobal`/`injectGlobal` 适合在组件外或需要显式共享状态的场景。

## createApp 与插件

```ts
import { createApp } from 'wevu'

const app = createApp({ data: () => ({}) })
app.use((runtime) => {
  runtime.config.globalProperties.$log = (...args: any[]) => console.log(...args)
})
// 若存在全局 App 构造器，会立即注册；否则可调用 app.mount(adapter?)
```

- 插件可以是函数或包含 `install()` 的对象。
- `runtimeApp.mount(adapter?)` 返回的实例暴露 `state`、`methods`、`computed`、`bindModel`、`watch`、`snapshot()`、`unmount()`，便于测试或自定义适配器。

## 组件使用要点

- props：在 `properties` 中声明，`setup(ctx)` 读取 `ctx.props`，用 `ctx.emit` 触发事件。
- 注册：`<config>` 的 `usingComponents` 需要包含子组件路径，脚本中无需 `import` 子组件。
- 模板：`@tap`、`v-if`、`v-for` 等会被 weapp-vite 编译为原生 WXML 语法。
- 支持双向绑定、自定义事件、页面特性（滚动监听/分享/收藏）等常见场景。
