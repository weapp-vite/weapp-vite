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

## Setup 兼容工具 API

### `useNativeInstance()` {#usenativeinstance}

- 用途：获取当前 setup 对应的原生实例。
- 源码：`runtime/vueCompat.ts`。

### `useRouter()` {#userouter}

- 用途：获取当前组件路径语义的 Router 对象。
- 行为：优先使用 `this.router`；不可用时回退 `this.pageRouter`；低版本基础库（`< 2.16.1`）再回退全局 `wx.*` 路由方法。
- 类型：可通过声明合并 `WevuTypedRouterRouteMap.entries` 收窄 `url` 字面量（`weapp-vite autoRoutes` 会自动注入该增强）。
- 源码：`runtime/vueCompat.ts`。

### `usePageRouter()` {#usepagerouter}

- 用途：获取当前页面路径语义的 Router 对象。
- 行为：优先使用 `this.pageRouter`；不可用时回退 `this.router`；低版本基础库（`< 2.16.1`）再回退全局 `wx.*` 路由方法。
- 类型：与 `useRouter()` 共享 `WevuTypedRouterRouteMap.entries` 收窄能力。
- 源码：`runtime/vueCompat.ts`。

### `useBindModel()` {#usebindmodel}

- 用途：创建绑定 payload（`value + onXxx`）辅助函数。
- 源码：`runtime/vueCompat.ts`。

### `useIntersectionObserver()` {#useintersectionobserver}

- 用途：在 `setup()` 中创建 `IntersectionObserver`，并在卸载时自动 `disconnect()`。
- 建议：优先用它替代 `onPageScroll + setData` 的可见性轮询逻辑。
- 源码：`runtime/intersectionObserver.ts`。

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
import { usePageRouter, useRouter } from 'wevu'

const router = useRouter()
const pageRouter = usePageRouter()

function gotoFromComponent() {
  router.navigateTo({ url: './detail' })
}

function gotoFromPage() {
  pageRouter.navigateTo({ url: './detail' })
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
