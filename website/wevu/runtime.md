---
title: 运行时与生命周期
---

# 运行时与生命周期

本页主要说明 wevu 运行时做了什么、哪些生命周期可用，以及常见的“为什么没触发/为什么没更新”的定位思路。

wevu 运行时的核心职责是：

- 把 `data/computed/methods/setup/watch` 等选项桥接到小程序 `Component() / App()`；
- 将 state + computed 生成快照（plain object），diff 后只下发变化路径到 `setData()`；
- 提供生命周期钩子与 `bindModel()` 等小程序友好能力。

:::tip 导入约定
所有 API 都从 `wevu` 主入口导入。
:::

## 更新链路：为什么 wevu 不需要 Virtual DOM

wevu 的渲染心智模型更接近“小程序原生”：

1. 你在 `setup()` 中创建响应式 state（`ref/reactive`）与 `computed`
2. 运行时把 **state + computed** 转成 **plain snapshot**（可序列化的普通对象）
3. 每次调度时对比“上一次 snapshot vs 新 snapshot”
4. 只把变化路径组装成 `setData({ 'a.b.c': next })` 的形式下发

这也是为什么你会看到一些“小程序语义”对行为有硬性影响：

- 小程序 `created` 阶段不能调用 `setData`：wevu 会缓冲由响应式更新产生的 `setData`，并在首次安全时机（组件 `attached` / 页面 `onLoad`）统一 flush（细节见 `/wevu/component`）。
- 小程序模板只能消费 JSON 友好的数据：`undefined` 会被归一化（通常变成 `null`），不要依赖“模板里区分 undefined 与缺失字段”的行为（见 `/wevu/compatibility`）。

## defineComponent：注册页面/组件

`defineComponent(options)` 会直接调用全局 `Component()` 完成注册（页面和组件都走 `Component()`，这是 wevu 的统一模型）。

```ts
import { defineComponent, onShow, ref } from 'wevu'

export default defineComponent({
  // 原生小程序字段保持原样（properties、options、lifetimes、pageLifetimes...）
  properties: { initial: { type: Number, value: 0 } },

  setup(props) {
    const count = ref(props.initial ?? 0)
    onShow(() => console.log('show'))
    return { count, inc: () => count.value++ }
  },
})
```

`defineComponent` 的 `data` 必须是函数（与 Vue 3 一致，和小程序原生对象写法不同）。原生小程序会在实例化时拷贝 `data` 对象以隔离实例；wevu 需要为每个实例创建独立的响应式 state/代理与快照 diff，因此要求返回新对象。

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

## 全局默认值（setWevuDefaults / resetWevuDefaults） {#wevu-defaults}

当你希望统一控制 `createApp`/`defineComponent` 的默认行为时，可以设置全局默认值：

```ts
import { resetWevuDefaults, setWevuDefaults } from 'wevu'

setWevuDefaults({
  app: {
    setData: {
      includeComputed: false,
    },
  },
  component: {
    options: {
      addGlobalClass: true,
    },
  },
})

// 测试或热更新时可重置
resetWevuDefaults()
```

规则说明：

- `app` 影响 `createApp()`；`component` 影响 `defineComponent()`/`createWevuComponent()`。
- 运行时会合并默认值与局部选项：`setData`/`options` 会做浅合并，其余字段按对象顶层覆盖。
- 必须在 `createApp()`/`defineComponent()` 之前调用；不会 retroactive 影响已创建的实例。

### 在 app.vue 顶层手动调用

如果你不使用 `weapp.wevu.defaults`，可以在 `app.vue` 顶层直接调用：

```vue
<script setup lang="ts">
import { setWevuDefaults } from 'wevu'

setWevuDefaults({
  component: {
    options: {
      addGlobalClass: true,
    },
  },
})
</script>
```

> 关键点：必须是**顶层语句**（不要放进 `setup()`/hook 里），这样才能早于 `createApp()` 执行。

> [!TIP]
> 使用 weapp-vite 时，可以通过 `weapp.wevu.defaults` 在编译期自动注入 `setWevuDefaults()`（见 `/config/shared#weapp-wevu-defaults`）。

## setup：签名与上下文

`setup` 与 Vue 3 对齐，仅支持 `setup(props, ctx)` 签名。
若不需要 `props`，可使用 `setup(_, ctx)`；若不需要 `ctx`，可只写 `setup(props)`。

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

## 生命周期钩子

### 通用钩子（页面/组件）

- `onShow` / `onHide` / `onReady` / `onUnload`

### 组件钩子（来自 lifetimes/pageLifetimes）

- `onMoved`（`lifetimes.moved`）
- `onError`（`lifetimes.error`）
- `onResize`（`pageLifetimes.resize`，组件场景）

### 页面钩子（Page 事件）

- `onPullDownRefresh`
- `onReachBottom`
- `onPageScroll`
- `onRouteDone`
- `onTabItemTap`
- `onResize`（页面场景）
- `onShareAppMessage`
- `onShareTimeline`
- `onAddToFavorites`

注意：分享/朋友圈/收藏是否触发由微信官方机制决定（例如右上角菜单/`open-type="share"`；朋友圈通常需配合 `wx.showShareMenu()` 开启菜单项）。
此外，小程序会对部分页面事件做“按需派发”：只有定义了对应页面方法，事件才会从渲染层派发到逻辑层；wevu 也仅在你定义了这些页面方法时才桥接 `setup()` 中注册的同名 hooks。
如果你使用 weapp-vite 构建，默认会在编译阶段根据你是否调用 `onPageScroll/onShareAppMessage/...` 自动补齐对应 `features.enableOnXxx = true`，以降低手动配置成本。

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
- `onErrorCaptured` → `onError`
- `onBeforeMount` / `onBeforeUnmount`：在 `setup()` 同步阶段立即执行（小程序无精确对应时机）
- `onBeforeUpdate` / `onUpdated`：在每次 `setData` 前/后触发（小程序没有“更新生命周期”，wevu 通过在更新链路里补齐语义）

## bindModel：模型绑定

`ctx.bindModel(path, options?)` 返回一个 `ModelBinding`：

- `binding.value` / `binding.update(value)`：读取或更新目标路径
- `binding.model(modelOptions?)`：生成事件 handler / value 字段（默认 `value` + `onInput`）

```ts
// setup(props, ctx) 内
const { model } = ctx.bindModel('form.price', {
  event: 'blur',
  formatter: v => Number(v) || 0,
})
const onPriceBlur = model().onBlur
```

```vue
<input :value="form.price" @blur="onPriceBlur" />
```

在 `<script setup>` 里可以用 `useBindModel()` 获取同一个能力，避免直接访问内部实例：

```ts
import { useBindModel } from 'wevu'

const bindModel = useBindModel()
const onPriceChange = bindModel<number>('form.price').model({ event: 'change' }).onChange
```

```vue
<t-input :value="form.price" @change="onPriceChange" />
```

默认解析器会优先取 `event.detail.value`，其次取 `event.target.value`；你也可以通过 `parser` 自定义解析逻辑。

> 注意：weapp-vite 模板编译目前不支持 `v-bind="object"` 的对象展开语法（不会生成任何属性），建议使用显式 `:value` + `@change/@input` 绑定。

## watch：组合式与选项式

### 组合式 watch

`watch()` / `watchEffect()` 与 Vue 3 类似，调度使用微任务队列；`deep` 默认采用“版本信号”策略（只订阅根版本号，不做深层遍历）：

```ts
import { setDeepWatchStrategy } from 'wevu'

setDeepWatchStrategy('traverse')
```

watch 返回的 stop handle 兼容旧写法，同时支持 `pause / resume` 暂停与恢复监听：

```ts
const { pause, resume, stop } = watch(() => state.form, () => {
  // handle changes
})

pause() // 暂停监听（避免同步循环）
resume() // 恢复监听
stop() // 停止监听
```

## 批处理：batch / startBatch / endBatch

当你需要在一次交互中同步修改很多字段（尤其是大列表、复杂表单）时，可以显式批处理以减少调度与 diff 次数：

```ts
import { batch, endBatch, ref, startBatch } from 'wevu'

const a = ref(0)
const b = ref(0)

batch(() => {
  a.value += 1
  b.value += 1
})

startBatch()
a.value += 1
b.value += 1
endBatch()
```

一般情况下不需要手动 batch：wevu 默认会在微任务中批量调度，但“同一 tick 内修改非常多字段”的场景，显式批处理更稳定。

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

## 在测试环境使用（Vitest/Node）

wevu 的 `defineComponent()` 依赖全局 `Component()`（以及部分小程序实例方法）。在 Vitest/Node 环境测试时，通常有两条路：

- 把业务逻辑下沉到纯函数/composable/service，避免直接依赖小程序构造器（最推荐）
- 对测试用例 stub 全局 `Component` 并断言注册参数（只测“桥接层”）

示例（只展示思路）：

```ts
import { expect, test, vi } from 'vitest'
import { defineComponent } from 'wevu'

test('defineComponent registers Component()', () => {
  const Component = vi.fn()
  // @ts-expect-error test stub
  globalThis.Component = Component

  defineComponent({ setup: () => ({}) })
  expect(Component).toHaveBeenCalledTimes(1)
})
```
