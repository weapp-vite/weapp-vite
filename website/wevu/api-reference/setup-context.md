---
title: Setup Context API
description: Wevu 的 setup(props, ctx) 除了 Vue 语义，还补齐了小程序运行时场景，特别是
  ctx.instance（原生实例）和 ctx.emit（事件派发）。
keywords:
  - Wevu
  - Vue SFC
  - api
  - reference
  - setup
  - context
  - 的
  - setup props
---

# Setup Context API（setup 上下文）

`wevu` 的 `setup(props, ctx)` 除了 Vue 语义，还补齐了小程序运行时场景，特别是 `ctx.instance`（原生实例）和 `ctx.emit`（事件派发）。

## 1. `setup` 签名与核心类型

| 类型/接口           | 链接                  | 说明                                         |
| ------------------- | --------------------- | -------------------------------------------- |
| `setup(props, ctx)` | `SetupFunction`       | 组件/页面 setup 函数签名。                   |
| `ctx`               | `SetupContext`        | setup 上下文总入口。                         |
| `ctx.runtime`       | `RuntimeInstance`     | 运行时实例（watch、snapshot、teardown 等）。 |
| `ctx.instance`      | `MiniProgramInstance` | 小程序原生实例。                             |
| `ctx.emit`          | `TriggerEventOptions` | 自定义事件派发入口。                         |

## 2. setup 上下文相关 API

| API                      | 类型入口          | 说明                     |
| ------------------------ | ----------------- | ------------------------ |
| `getCurrentInstance`     | `RuntimeInstance` | 获取当前运行时实例。     |
| `getCurrentSetupContext` | `SetupContext`    | 获取当前 setup context。 |

## 3. provide/inject

| API             | 类型入口               | 说明                                                  |
| --------------- | ---------------------- | ----------------------------------------------------- |
| `provide`       | `InjectionKey<T>` 兼容 | 在当前组件树提供依赖。                                |
| `inject`        | `T \| undefined`       | 从当前组件树读取依赖。                                |
| `provideGlobal` | `void`                 | 已弃用。全局 provide 兼容入口，仅建议用于旧代码过渡。 |
| `injectGlobal`  | `T`                    | 已弃用。全局 inject 兼容入口，仅建议用于旧代码过渡。  |

## 4. 推荐：通过 `ctx.instance` 操作原生实例

在 Wevu 里，和小程序实例直接耦合的方法，推荐放在 `ctx.instance` 上调用，而不是依赖 `this`：

- `ctx.instance.triggerEvent(...)`
- `ctx.instance.createSelectorQuery()`
- `ctx.instance.createIntersectionObserver(...)`
- `ctx.instance.setData(...)`
- `ctx.instance.router` / `ctx.instance.pageRouter`（基础库 `2.16.1+`）
- 以及平台原生 `wx` 组件实例 API

### 示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { getCurrentSetupContext, provide, ref } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
const visible = ref(false)
provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  visible.value = true
  ctx?.emit('open', { ok: true })
  ctx?.instance?.triggerEvent?.('opened', { ts: Date.now() })
}

function measure() {
  const ctx = getCurrentSetupContext()
  const query = ctx?.instance?.createSelectorQuery?.()
  query?.select('#target').boundingClientRect()
  query?.exec(console.log)
}

function watchBanner() {
  const ctx = getCurrentSetupContext()
  const observer = ctx?.instance?.createIntersectionObserver?.({ thresholds: [0, 1] })
  observer?.relativeToViewport().observe('#target', console.log)
}

function patchRaw() {
  const ctx = getCurrentSetupContext()
  ctx?.instance?.setData?.({ rawFlag: true })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
  <button @tap="measure">
    measure
  </button>
  <button @tap="watchBanner">
    watchBanner
  </button>
  <button @tap="patchRaw">
    patchRaw
  </button>
</template>
```

```vue [JavaScript]
<script setup>
import { getCurrentSetupContext, provide, ref } from 'wevu'

const visible = ref(false)
provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  visible.value = true
  ctx?.emit('open', { ok: true })
  ctx?.instance?.triggerEvent?.('opened', { ts: Date.now() })
}

function measure() {
  const ctx = getCurrentSetupContext()
  const query = ctx?.instance?.createSelectorQuery?.()
  query?.select('#target').boundingClientRect()
  query?.exec(console.log)
}

function watchBanner() {
  const ctx = getCurrentSetupContext()
  const observer = ctx?.instance?.createIntersectionObserver?.({ thresholds: [0, 1] })
  observer?.relativeToViewport().observe('#target', console.log)
}

function patchRaw() {
  const ctx = getCurrentSetupContext()
  ctx?.instance?.setData?.({ rawFlag: true })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
  <button @tap="measure">
    measure
  </button>
  <button @tap="watchBanner">
    watchBanner
  </button>
  <button @tap="patchRaw">
    patchRaw
  </button>
</template>
```

:::

> [!WARNING]
> `provideGlobal()` / `injectGlobal()` 仍然保留导出，但属于兼容性 API。
> 新代码请优先使用 `provide()` / `inject()`，或在需要稳定全局共享时改用 store。

## 5. setup 辅助工具

| API                       | 类型入口                               | 说明                                         |
| ------------------------- | -------------------------------------- | -------------------------------------------- |
| `useBindModel`            | `ModelBindingOptions` / `ModelBinding` | 生成小程序可直接绑定的数据 + 事件处理器。    |
| `useDisposables`          | `DisposableBag`                        | 创建自动随卸载释放的清理袋。                 |
| `useIntersectionObserver` | `IntersectionObserver`                 | setup 内创建观察器，自动在卸载阶段断开连接。 |

## 5.1 路由辅助

| API                   | 类型入口 | 说明                                                                                                                                                                                                     |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useNativeRouter`     | `Router` | 获取组件路径语义 Router。优先 `this.router`，再回退 `this.pageRouter`，低版本基础库降级到全局 `wx/my/tt`；可通过 `WevuTypedRouterRouteMap.entries` 收窄 `url`，并可用 `tabBarEntries` 收窄 `switchTab`。 |
| `useNativePageRouter` | `Router` | 获取页面路径语义 Router。优先 `this.pageRouter`，再回退 `this.router`，低版本基础库降级到全局 `wx/my/tt`；可通过 `WevuTypedRouterRouteMap.entries` 收窄 `url`，并可用 `tabBarEntries` 收窄 `switchTab`。 |

### 5.1.1 Router 语义矩阵

Router 原生对象从微信基础库 `2.16.1+` 可用。`wevu` 会按顺序做能力回退，因此建议你在设计路由 API 时明确“语义优先级”：

| 调用位置           | `useNativeRouter()` 基准   | `useNativePageRouter()` 基准 |
| ------------------ | -------------------------- | ---------------------------- |
| 页面 `setup()`     | 页面路径                   | 页面路径                     |
| 组件 `setup()`     | 组件路径                   | 组件所在页面路径             |
| 低版本全局回退场景 | 当前激活页（全局路由对象） | 当前激活页（全局路由对象）   |

### 5.1.2 兼容建议

- 需要跨版本基路径稳定时，优先 `useNativePageRouter()`。
- 只在“组件目录相对路径”是业务需求时使用 `useNativeRouter()`。
- 对低版本必须一致的路由，优先绝对路径（`/pages/**`、`/packageA/pages/**`）。

## 5.2 页面 layout

| API             | 类型入口          | 说明                                         |
| --------------- | ----------------- | -------------------------------------------- |
| `usePageLayout` | `PageLayoutState` | 读取当前页面 layout 状态（只读响应式视图）。 |
| `setPageLayout` | `void`            | 在当前页面上下文中显式切换 layout。          |

说明：

- 这组 API 属于 `wevu` 根入口的页面运行时辅助能力，不属于 `wevu/router`。
- `setPageLayout()` 需要当前页面实例上下文，适合在页面 `setup()`、事件回调或当前页链路内调用。
- 若项目开启了 Weapp-vite 的 layout 类型生成，`WevuPageLayoutMap` 会被增强，从而收窄 layout 名称与 props。

## 5.3 页面与实例工具

| API                            | 类型入口                          | 说明                                               |
| ------------------------------ | --------------------------------- | -------------------------------------------------- |
| `usePageScrollThrottle`        | `UsePageScrollThrottleOptions`    | 在 `onPageScroll` 基础上提供节流监听，并自动清理。 |
| `useUpdatePerformanceListener` | `UpdatePerformanceListenerResult` | 注册原生更新性能监听，页面/组件卸载时自动移除。    |

## 6. 相关页

- 生命周期与页面事件：[/wevu/api-reference/lifecycle](/wevu/api-reference/lifecycle)
- 运行时桥接与调试：[/wevu/api-reference/runtime-bridge](/wevu/api-reference/runtime-bridge)
- 页面 layout：[/config/route-rules](/config/route-rules)
- 高阶导航子入口：[/wevu/router](/wevu/router)
