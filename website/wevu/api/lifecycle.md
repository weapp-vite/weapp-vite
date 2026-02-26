---
title: Lifecycle API
description: 本页仅覆盖 wevu 实际导出的生命周期 Hook（源码：runtime/hooks.ts），并补充与小程序 lifetimes/pageLifetimes 的映射说明。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - lifecycle
  - hooks
---

# Lifecycle API（生命周期）

以下条目严格对应 `packages/wevu/src/runtime/hooks.ts` 的导出函数。所有 Hook 都要求在 `setup()` 同步阶段调用。

## App 生命周期 Hook

### `onLaunch()` {#onlaunch}

- 作用域：`App`
- 源码行为：注册到 `onLaunch`。

### `onShow()` {#onshow}

- 作用域：`App / Page / Component`
- 源码行为：统一注册到 `onShow`（App 与页面/组件共用函数名）。

### `onHide()` {#onhide}

- 作用域：`App / Page / Component`
- 源码行为：统一注册到 `onHide`。

### `onError()` {#onerror}

- 作用域：`App / Component`
- 源码行为：注册到 `onError`。

### `onPageNotFound()` {#onpagenotfound}

- 作用域：`App`
- 源码行为：注册到 `onPageNotFound`。

### `onUnhandledRejection()` {#onunhandledrejection}

- 作用域：`App`
- 源码行为：注册到 `onUnhandledRejection`。

### `onThemeChange()` {#onthemechange}

- 作用域：`App`
- 源码行为：注册到 `onThemeChange`。

## 页面生命周期 Hook

### `onLoad()` {#onload}

- 作用域：`Page`
- 源码行为：注册到页面 `onLoad`。

### `onReady()` {#onready}

- 作用域：`Page / Component`
- 源码行为：注册到 `onReady`；组件通过 `lifetimes.ready` 触发。

### `onUnload()` {#onunload}

- 作用域：`Page / Component`
- 源码行为：在页面 `onUnload` 或组件 teardown 时统一触发。

## 页面事件 Hook

### `onPullDownRefresh()` {#onpulldownrefresh}

- 作用域：`Page`
- 源码行为：注册到页面 `onPullDownRefresh`。

### `onReachBottom()` {#onreachbottom}

- 作用域：`Page`
- 源码行为：注册到页面 `onReachBottom`。

### `onPageScroll()` {#onpagescroll}

- 作用域：`Page`
- 源码行为：注册到页面 `onPageScroll`。

### `onRouteDone()` {#onroutedone}

- 作用域：`Page / Component`
- 源码行为：注册到 `onRouteDone`；组件通过 `pageLifetimes.routeDone` 桥接触发。

### `onTabItemTap()` {#ontabitemtap}

- 作用域：`Page`
- 源码行为：注册到页面 `onTabItemTap`。

### `onResize()` {#onresize}

- 作用域：`Page / Component`
- 源码行为：注册到 `onResize`；组件通过 `pageLifetimes.resize` 桥接触发。

## 返回值型页面 Hook

### `onShareAppMessage()` {#onshareappmessage}

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于分享配置。

### `onShareTimeline()` {#onsharetimeline}

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于朋友圈分享配置。

### `onAddToFavorites()` {#onaddtofavorites}

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于收藏配置。

### `onSaveExitState()` {#onsaveexitstate}

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于退出状态保存。

## 组件扩展 Hook

### `onAttached()` {#onattached}

- 作用域：`Component`
- 源码行为：在组件 `lifetimes.attached` 阶段触发。

### `onDetached()` {#ondetached}

- 作用域：`Component`
- 源码行为：在组件 `lifetimes.detached` 阶段触发。

### `onMoved()` {#onmoved}

- 作用域：`Component`
- 源码行为：注册到 `lifetimes.moved`。

## Vue 语义对齐 Hook

### `onBeforeMount()` {#onbeforemount}

- 对齐语义：Vue `beforeMount`
- 源码行为：在 `setup()` 内同步立即执行。

### `onMounted()` {#onmounted}

- 对齐语义：Vue `mounted`
- 源码行为：映射到 `onReady`。

### `onBeforeUpdate()` {#onbeforeupdate}

- 对齐语义：Vue `beforeUpdate`
- 源码行为：映射到内部 `__wevuOnBeforeUpdate`。

### `onUpdated()` {#onupdated}

- 对齐语义：Vue `updated`
- 源码行为：映射到内部 `__wevuOnUpdated`。

### `onBeforeUnmount()` {#onbeforeunmount}

- 对齐语义：Vue `beforeUnmount`
- 源码行为：在 `setup()` 内同步立即执行（小程序无对应原生 before-unmount）。

### `onUnmounted()` {#onunmounted}

- 对齐语义：Vue `unmounted`
- 源码行为：映射到 `onUnload`。

### `onActivated()` {#onactivated}

- 对齐语义：Vue `activated`
- 源码行为：映射到 `onShow`。

### `onDeactivated()` {#ondeactivated}

- 对齐语义：Vue `deactivated`
- 源码行为：映射到 `onHide`。

### `onErrorCaptured()` {#onerrorcaptured}

- 对齐语义：Vue `errorCaptured`
- 源码行为：映射到 `onError` 包装调用。

### `onServerPrefetch()` {#onserverprefetch}

- 对齐语义：Vue `serverPrefetch`
- 源码行为：保留 API 形态，仅做调用时机校验，不执行实际逻辑。

## 小程序原生生命周期映射（说明）

以下是桥接关系说明，不是 `wevu` 直接导出的 Hook API。

### `lifetimes.created` {#lifetimes-created}

- 映射：组件初始化桥接（无独立 `onCreated` 导出）。

### `lifetimes.attached` {#lifetimes-attached}

- 映射：组件挂载流程（可使用 `onAttached`；`onMounted` 仍映射 `onReady`）。

### `lifetimes.ready` {#lifetimes-ready}

- 映射：`onReady`。

### `lifetimes.moved` {#lifetimes-moved}

- 映射：`onMoved`。

### `lifetimes.detached` {#lifetimes-detached}

- 映射：组件 teardown（可使用 `onDetached`）+ `onUnload` 钩子链（含 `onUnmounted`）。

### `lifetimes.error` {#lifetimes-error}

- 映射：`onError`。

### `pageLifetimes.show` {#pagelifetimes-show}

- 映射：`onShow`。

### `pageLifetimes.hide` {#pagelifetimes-hide}

- 映射：`onHide`。

### `pageLifetimes.resize` {#pagelifetimes-resize}

- 映射：`onResize`。

### `pageLifetimes.routeDone` {#pagelifetimes-routedone}

- 映射：`onRouteDone`。

## 示例

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import {
  onMounted,
  onPageScroll,
  onRouteDone,
  onShareAppMessage,
  onShow,
  ref,
} from 'wevu'

const scrollTop = ref(0)

onShow(() => {
  console.log('page show')
})

onMounted(() => {
  console.log('mounted')
})

onPageScroll((e) => {
  scrollTop.value = e.scrollTop
})

onRouteDone(() => {
  console.log('route done')
})

onShareAppMessage(() => ({
  title: 'Wevu 页面分享',
  path: '/pages/index/index',
}))
</script>

<template>
  <view>scrollTop: {{ scrollTop }}</view>
</template>
```

```vue [JavaScript]
<script setup>
import {
  onMounted,
  onPageScroll,
  onRouteDone,
  onShareAppMessage,
  onShow,
  ref,
} from 'wevu'

const scrollTop = ref(0)

onShow(() => {
  console.log('page show')
})

onMounted(() => {
  console.log('mounted')
})

onPageScroll((e) => {
  scrollTop.value = e.scrollTop
})

onRouteDone(() => {
  console.log('route done')
})

onShareAppMessage(() => ({
  title: 'Wevu 页面分享',
  path: '/pages/index/index',
}))
</script>

<template>
  <view>scrollTop: {{ scrollTop }}</view>
</template>
```

:::
