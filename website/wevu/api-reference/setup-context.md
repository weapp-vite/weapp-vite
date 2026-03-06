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

| API       | 类型入口               | 说明                   |
| --------- | ---------------------- | ---------------------- |
| `provide` | `InjectionKey<T>` 兼容 | 在当前组件树提供依赖。 |
| `inject`  | `T \| undefined`       | 从当前组件树读取依赖。 |

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

## 5. 双向绑定辅助

| API            | 类型入口                               | 说明                                      |
| -------------- | -------------------------------------- | ----------------------------------------- |
| `useBindModel` | `ModelBindingOptions` / `ModelBinding` | 生成小程序可直接绑定的数据 + 事件处理器。 |

## 5.1 路由辅助

| API             | 类型入口 | 说明                                                                                                                                                        |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRouter`     | `Router` | 获取组件路径语义 Router。优先 `this.router`，再回退 `this.pageRouter`，低版本基础库降级到全局 `wx.*`；可通过 `WevuTypedRouterRouteMap.entries` 收窄 `url`。 |
| `usePageRouter` | `Router` | 获取页面路径语义 Router。优先 `this.pageRouter`，再回退 `this.router`，低版本基础库降级到全局 `wx.*`；可通过 `WevuTypedRouterRouteMap.entries` 收窄 `url`。 |

## 5.2 可见性监听辅助

| API                       | 类型入口               | 说明                                                            |
| ------------------------- | ---------------------- | --------------------------------------------------------------- |
| `useIntersectionObserver` | `IntersectionObserver` | setup 内创建观察器，自动在 `onUnload/onDetached` 阶段断开连接。 |

## 6. 相关页

- 生命周期与页面事件：[/wevu/api-reference/lifecycle](/wevu/api-reference/lifecycle)
- 运行时桥接与调试：[/wevu/api-reference/runtime-bridge](/wevu/api-reference/runtime-bridge)
