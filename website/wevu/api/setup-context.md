---
title: Setup Context API
description: 本页严格对应 wevu 源码中的 setup 上下文相关导出（runtime/hooks.ts、runtime/provide.ts、runtime/register.ts、runtime/vueCompat.ts）。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - setup
  - context
---

# Setup Context API（setup 上下文）

`setup(props, ctx)` 的字段语义来自 `SetupContext` 类型；本页重点列出可直接导入调用的公开 API。

`ctx` 常见字段（类型定义语义）：

- `ctx.runtime`：当前 `RuntimeInstance`
- `ctx.instance`：原生小程序实例
- `ctx.emit`：事件派发函数

## 实例与上下文访问 API

### `getCurrentInstance()` {#getcurrentinstance}

- 用途：获取当前运行时实例。
- 源码：`runtime/hooks.ts`。

### `getCurrentSetupContext()` {#getcurrentsetupcontext}

- 用途：获取当前 setup context。
- 源码：`runtime/hooks.ts`。

## 依赖注入 API

### `provide()` {#provide}

- 用途：在当前组件树提供依赖。
- 源码：`runtime/provide.ts`。

### `inject()` {#inject}

- 用途：从上层读取依赖。
- 源码：`runtime/provide.ts`。

### `provideGlobal()` / `injectGlobal()`（Deprecated） {#provideglobal}

- 用途：已弃用的全局 provide/inject 兼容入口。
- 说明：当前更推荐优先使用 `provide()` / `inject()`；无实例上下文时，它们本身就会回退到全局存储。
- 源码：`runtime/provide.ts`。

> [!WARNING]
> 这组 API 仅为兼容旧代码而保留，不建议在新代码中继续使用。
> 优先使用 `provide()` / `inject()`；需要稳定的跨页面全局共享时，优先考虑 store。

## Setup 兼容工具 API

### `useNativeInstance()` {#usenativeinstance}

- 用途：获取当前 setup 对应的原生实例。
- 源码：`runtime/vueCompat.ts`。

### `useNativeRouter()` {#usenativerouter}

- 用途：获取当前组件路径语义的 Router 对象。
- 行为：优先使用 `this.router`；不可用时回退 `this.pageRouter`；低版本基础库（`< 2.16.1`）再回退全局路由方法（`wx`/`my`/`tt`）。
- 类型：可通过声明合并 `WevuTypedRouterRouteMap.entries` 收窄 `url` 字面量；可选 `tabBarEntries` 进一步收窄 `switchTab`（`weapp-vite autoRoutes` 会自动注入 `entries`）。
- 源码：`runtime/vueCompat.ts`。

### `useNativePageRouter()` {#usenativepagerouter}

- 用途：获取当前页面路径语义的 Router 对象。
- 行为：优先使用 `this.pageRouter`；不可用时回退 `this.router`；低版本基础库（`< 2.16.1`）再回退全局路由方法（`wx`/`my`/`tt`）。
- 类型：与 `useNativeRouter()` 共享 `WevuTypedRouterRouteMap.entries / tabBarEntries` 收窄能力。
- 源码：`runtime/vueCompat.ts`。

### Router 语义与兼容建议

`Router` 能力在微信基础库 `2.16.1+` 才有原生对象。`wevu` 在低版本会自动降级到全局路由方法，所以建议你明确区分“路径语义”与“兼容语义”。

| 场景           | 推荐 API                | 相对路径基准                               |
| -------------- | ----------------------- | ------------------------------------------ |
| 页面内跳转     | `useNativePageRouter()` | 当前页面路径（更稳定）                     |
| 组件内组件路径 | `useNativeRouter()`     | 当前组件路径                               |
| 组件内页面路径 | `useNativePageRouter()` | 组件所在页面路径                           |
| 低版本降级路径 | 自动回退                | 回退为全局 `wx/my/tt` 语义（按当前激活页） |

**实践建议：**

- 需要跨版本稳定时，优先使用 `useNativePageRouter()`（尤其是页面方法被延迟调用、跨页调用时）。
- 当你明确要“相对组件目录”导航时，使用 `useNativeRouter()`。
- 对低版本必须严格一致的跳转，优先使用绝对路径（如 `/pages/foo/index`），避免依赖相对路径基准。
- 若开启 `autoRoutes`，可结合路由联合类型减少拼写错误（见 `/guide/auto-routes`）。

### `useBindModel()` {#usebindmodel}

- 用途：创建绑定 payload（`value + onXxx`）辅助函数。
- 源码：`runtime/vueCompat.ts`。

### `useChangeModel()` {#usechangemodel}

- 用途：创建默认使用 `change` 事件的 model 绑定辅助函数。
- 适合：TDesign、Vant 等第三方小程序组件库中大量使用 `change` 事件的表单场景。
- 行为：等价于 `useBindModel({ event: 'change' }).model(...)` 的收敛写法。
- 源码：`runtime/vueCompat.ts`。

示例：

```vue
<script setup lang="ts">
import { reactive, useChangeModel } from 'wevu'

const formState = reactive({
  name: '',
  budget: 0,
})
const changeModel = useChangeModel()

const nameModel = changeModel<string>('formState.name')
const budgetModel = changeModel<number>('formState.budget', {
  parser: event => Number(event?.detail?.value ?? 0),
})
</script>

<template>
  <t-input v-bind="nameModel" />
  <t-slider v-bind="budgetModel" />
</template>
```

### `useIntersectionObserver()` {#useintersectionobserver}

- 用途：在 `setup()` 中创建 `IntersectionObserver`，并在卸载时自动 `disconnect()`。
- 建议：优先用它替代 `onPageScroll + setData` 的可见性轮询逻辑。
- 源码：`runtime/intersectionObserver.ts`。

### `useElementIntersectionObserver()` {#useelementintersectionobserver}

- 用途：声明式观察当前页面/组件内某个 selector 的可见性，并在卸载时自动断开。
- 适合：商品卡片曝光、懒加载、可见区域统计。
- 说明：`selector`、`enabled`、`observerOptions` 支持普通值、Ref 或 getter；当 selector 或 enabled 变化时会自动重新 observe。
- 源码：`runtime/elementIntersectionObserver.ts`。

示例：

```vue
<script setup lang="ts">
import { ref, useElementIntersectionObserver } from 'wevu'

const visible = ref(false)

useElementIntersectionObserver({
  selector: '#goods-card',
  relativeToViewport: { bottom: 80 },
  onObserve(result: any) {
    visible.value = Number(result?.intersectionRatio ?? 0) > 0
  },
})
</script>
```

### `useSelectorQuery()` {#useselectorquery}

- 用途：创建绑定当前原生实例的 `SelectorQuery` 工厂。
- 适合：需要直接调用小程序 `select()` / `selectAll()` / `exec()` 的高级节点查询。
- 源码：`runtime/selectorQuery.ts`。

### `useBoundingClientRect()` {#useboundingclientrect}

- 用途：创建节点布局查询函数。
- 说明：默认查询单个节点；传入 `{ all: true }` 时返回节点数组。
- 源码：`runtime/selectorQuery.ts`。

### `useSelectorFields()` {#useselectorfields}

- 用途：按小程序 `fields()` 语义读取节点字段。
- 说明：必须显式传入 `fields`，例如 `{ size: true, dataset: true }`。
- 源码：`runtime/selectorQuery.ts`。

### `useScrollOffset()` {#usescrolloffset}

- 用途：读取 scroll-view 等可滚动节点的滚动位置。
- 说明：默认查询单个节点；传入 `{ all: true }` 时返回节点数组。
- 源码：`runtime/selectorQuery.ts`。

### `useDisposables()` {#usedisposables}

- 用途：创建一个自动随页面/组件卸载执行的清理袋。
- 适合：定时器、请求任务、事件退订函数、`disconnect()` / `abort()` / `stop()` 一类资源清理。
- 源码：`runtime/disposables.ts`。

### `usePageLayout()` / `setPageLayout()` {#usepagelayout}

- 用途：读取或切换当前页面的 layout 状态。
- 说明：这是 `wevu` 根入口的页面运行时辅助能力，常与 Weapp-vite 的 `routeRules.layout`、`definePageMeta({ layout })` 配合。
- 源码：`runtime/pageLayout.ts`。

### `usePageStack()` / `getCurrentPageStackSnapshot()` {#usepagestack}

- 用途：读取当前小程序页面栈快照。
- 返回：`currentRoute`、`stackLength`、`canGoBack` 与 `refresh()`。
- 适合：自定义导航栏返回按钮、页面层级提示、页面栈相关 UI。
- 说明：`getCurrentPageStackSnapshot()` 可在非响应式场景读取一次性快照；`usePageStack()` 必须在 `setup()` 同步阶段调用。
- 源码：`runtime/pageEnvironment.ts`。

### `useNavigationBarMetrics()` / `getNavigationBarMetrics()` {#usenavigationbarmetrics}

- 用途：计算自定义导航栏需要的状态栏、导航栏和总高度。
- 返回：`statusBarHeight`、`navigationBarHeight`、`navigationHeight` 与 `refresh()`。
- 适合：自定义导航栏布局、沉浸式页面顶部安全区。
- 说明：读取 `getSystemInfoSync()` 与 `getMenuButtonBoundingClientRect()`；不可用时使用默认高度兜底。
- 源码：`runtime/pageEnvironment.ts`。

### `usePageScrollThrottle()` {#usepagescrollthrottle}

- 用途：在 `onPageScroll()` 基础上提供节流包装，并在卸载时自动清理。
- 适合：吸顶状态、滚动进度、轻量联动，而不是每次滚动都直接 `setData`。
- 源码：`runtime/pageScroll.ts`。

### `useUpdatePerformanceListener()` {#useupdateperformancelistener}

- 用途：注册原生 `setUpdatePerformanceListener` 监听，并在卸载时自动移除。
- 适合：排查页面/组件更新耗时与更新结果。
- 源码：`runtime/updatePerformance.ts`。

### `useAsyncPullDownRefresh()` {#useasyncpulldownrefresh}

- 用途：注册异步下拉刷新回调，并在回调结束后自动停止宿主下拉刷新状态。
- 适合：页面刷新逻辑需要 `await` 请求、错误处理和统一 `stopPullDownRefresh()` 的场景。
- 说明：默认调用 `wpi.stopPullDownRefresh()`；可通过 `stopPullDownRefresh` 注入自定义停止函数，便于测试或平台差异适配。
- 源码：`runtime/pullDownRefresh.ts`。

示例：

```vue
<script setup lang="ts">
import { ref, useAsyncPullDownRefresh } from 'wevu'

const loading = ref(false)

async function reload() {
  loading.value = true
  try {
    await fetchList()
  }
  finally {
    loading.value = false
  }
}

useAsyncPullDownRefresh(reload, {
  onError(error) {
    console.warn('refresh failed:', error)
  },
})
</script>
```

## 示例

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { getCurrentSetupContext, provide, ref, useBindModel, useNativeInstance } from 'wevu'

const visible = ref(false)
const model = useBindModel({
  prop: 'modelValue',
  event: 'update:modelValue',
})

provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  const instance = useNativeInstance()
  visible.value = true
  model.setValue?.(true)
  ctx?.emit('open', { ok: true })
  instance.triggerEvent?.('opened', { ts: Date.now() })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
</template>
```

```vue [JavaScript]
<script setup>
import { getCurrentSetupContext, provide, ref, useBindModel, useNativeInstance } from 'wevu'

const visible = ref(false)
const model = useBindModel({
  prop: 'modelValue',
  event: 'update:modelValue',
})

provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  const instance = useNativeInstance()
  visible.value = true
  model.setValue?.(true)
  ctx?.emit('open', { ok: true })
  instance.triggerEvent?.('opened', { ts: Date.now() })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
</template>
```

:::

### IntersectionObserver 示例

```vue
<script setup lang="ts">
import { ref, useIntersectionObserver } from 'wevu'

const visible = ref(false)
const io = useIntersectionObserver({ thresholds: [0, 0.5, 1] })

io
  .relativeToViewport({ bottom: 0 })
  .observe('#ad-banner', (res) => {
    visible.value = !!res?.intersectionRatio && res.intersectionRatio > 0
  })
</script>

<template>
  <view id="ad-banner">
    banner visible: {{ visible }}
  </view>
</template>
```

### Router 示例

```vue
<script setup lang="ts">
import type { AutoRoutes } from 'weapp-vite/auto-routes'
import { useNativePageRouter, useNativeRouter } from 'wevu'

const router = useNativeRouter()
const pageRouter = useNativePageRouter()
type RouteEntry = AutoRoutes['entries'][number]

function gotoFromComponent() {
  // 组件路径语义：在自定义组件中通常相对组件目录
  router.navigateTo({ url: './detail' })
}

function gotoFromPage() {
  // 页面路径语义：相对页面目录，更适合稳定基路径场景
  pageRouter.navigateTo({ url: './detail' })
}

function gotoStable(route: RouteEntry) {
  // 低版本兼容要求高时，优先绝对路径
  pageRouter.navigateTo({ url: route })
}
</script>

<template>
  <button @tap="gotoFromComponent">
    component router
  </button>
  <button @tap="gotoFromPage">
    page router
  </button>
</template>
```
