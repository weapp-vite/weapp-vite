---
title: Lifecycle API
description: Wevu 生命周期 API 都需要在 setup() 的同步阶段调用。
keywords:
  - Wevu
  - Vue SFC
  - 微信小程序
  - api
  - reference
  - lifecycle
  - 生命周期
  - 都需要在
---

# Lifecycle API（生命周期）

`wevu` 生命周期 API 都需要在 `setup()` 的同步阶段调用。

## 1. App 生命周期

| API                    | 类型入口           | 说明                       |
| ---------------------- | ------------------ | -------------------------- |
| `onLaunch`             | `DefineAppOptions` | 小程序 App 启动。          |
| `onShow`               | `RuntimeApp`       | App 进入前台。             |
| `onHide`               | `RuntimeApp`       | App 进入后台。             |
| `onError`              | `RuntimeApp`       | 运行时错误回调。           |
| `onPageNotFound`       | `RuntimeApp`       | 路由未命中。               |
| `onUnhandledRejection` | `RuntimeApp`       | 未处理 Promise rejection。 |
| `onThemeChange`        | `RuntimeApp`       | 系统主题变化。             |

## 2. 页面与组件通用生命周期

| API        | 类型入口          | 说明                       |
| ---------- | ----------------- | -------------------------- |
| `onLoad`   | `RuntimeInstance` | 页面参数加载（页面常用）。 |
| `onReady`  | `RuntimeInstance` | 首次渲染完成。             |
| `onShow`   | `RuntimeInstance` | 页面/组件显示。            |
| `onHide`   | `RuntimeInstance` | 页面/组件隐藏。            |
| `onUnload` | `RuntimeInstance` | 页面卸载。                 |

## 3. 组件渲染阶段（Vue 风格）

| API                | 类型入口          | 说明                      |
| ------------------ | ----------------- | ------------------------- |
| `onBeforeMount`    | `RuntimeInstance` | 挂载前。                  |
| `onMounted`        | `RuntimeInstance` | 挂载后。                  |
| `onBeforeUpdate`   | `RuntimeInstance` | 更新前。                  |
| `onUpdated`        | `RuntimeInstance` | 更新后。                  |
| `onBeforeUnmount`  | `RuntimeInstance` | 卸载前。                  |
| `onUnmounted`      | `RuntimeInstance` | 卸载后。                  |
| `onActivated`      | `RuntimeInstance` | 激活（缓存场景）。        |
| `onDeactivated`    | `RuntimeInstance` | 失活（缓存场景）。        |
| `onErrorCaptured`  | `RuntimeInstance` | 捕获子树错误。            |
| `onServerPrefetch` | `RuntimeInstance` | 兼容 Vue 语义的预取钩子。 |

## 4. 小程序特有页面事件

| API                 | 类型入口       | 说明           |
| ------------------- | -------------- | -------------- |
| `onPageScroll`      | `PageFeatures` | 页面滚动。     |
| `onPullDownRefresh` | `PageFeatures` | 下拉刷新。     |
| `onReachBottom`     | `PageFeatures` | 触底事件。     |
| `onRouteDone`       | `PageFeatures` | 页面路由完成。 |
| `onTabItemTap`      | `PageFeatures` | Tab 点击。     |
| `onResize`          | `PageFeatures` | 视图尺寸变化。 |

## 5. 带返回值的页面钩子

| API                 | 类型入口       | 说明                   |
| ------------------- | -------------- | ---------------------- |
| `onShareAppMessage` | `PageFeatures` | 自定义转发内容。       |
| `onShareTimeline`   | `PageFeatures` | 自定义朋友圈分享内容。 |
| `onAddToFavorites`  | `PageFeatures` | 添加收藏。             |
| `onSaveExitState`   | `PageFeatures` | 离开时保存状态。       |

## 6. 小程序组件生命周期（lifetimes / pageLifetimes）

### 6.1 官方生命周期清单（组件侧）

| 分类            | 官方生命周期                                            |
| --------------- | ------------------------------------------------------- |
| `lifetimes`     | `created / attached / ready / moved / detached / error` |
| `pageLifetimes` | `show / hide / resize / routeDone`                      |

### 6.2 Wevu 对应能力（组合式 + 桥接）

| 官方生命周期              | Wevu 对应能力                                      | 说明                                         |
| ------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `lifetimes.created`       | 组件注册时内部桥接（无独立 `onCreated` Hook）      | 已覆盖；可继续使用原生 `lifetimes.created`。 |
| `lifetimes.attached`      | 组件注册时内部桥接 + `onMounted`（组合式）         | 已覆盖；常用组合式写法是 `onMounted`。       |
| `lifetimes.ready`         | `onReady`                                          | 已覆盖。                                     |
| `lifetimes.moved`         | `onMoved`                                          | 已覆盖。                                     |
| `lifetimes.detached`      | 组件注册时内部桥接 + `onBeforeUnmount/onUnmounted` | 已覆盖。                                     |
| `lifetimes.error`         | `onError`                                          | 已覆盖。                                     |
| `pageLifetimes.show`      | `onShow`                                           | 已覆盖。                                     |
| `pageLifetimes.hide`      | `onHide`                                           | 已覆盖。                                     |
| `pageLifetimes.resize`    | `onResize`                                         | 已覆盖。                                     |
| `pageLifetimes.routeDone` | `onRouteDone`                                      | 已覆盖（微信官方基础库 `2.31.2+`）。         |

## 7. 小程序组件扩展 Hook（组合式）

| API               | 类型入口                   | 说明                                                           |
| ----------------- | -------------------------- | -------------------------------------------------------------- |
| `onAttached`      | `RuntimeInstance`          | 组件 attached 时触发（对应 `lifetimes.attached`）。            |
| `onDetached`      | `RuntimeInstance`          | 组件 detached 时触发（对应 `lifetimes.detached`）。            |
| `onMoved`         | `MiniProgramPageLifetimes` | 组件节点位置变更。                                             |
| `onError`         | `MiniProgramPageLifetimes` | 组件或 App 错误（按上下文桥接）。                              |
| `onShow`          | `RuntimeInstance`          | 组件在页面 show 时触发（由 `pageLifetimes.show` 桥接）。       |
| `onHide`          | `RuntimeInstance`          | 组件在页面 hide 时触发（由 `pageLifetimes.hide` 桥接）。       |
| `onResize`        | `PageFeatures`             | 组件所在页面 resize 时触发（由 `pageLifetimes.resize` 桥接）。 |
| `onMounted`       | `RuntimeInstance`          | 组件 attached 后触发（对应 `lifetimes.attached`）。            |
| `onBeforeUnmount` | `RuntimeInstance`          | 组件 detached 前触发（对应 `lifetimes.detached`）。            |
| `onUnmounted`     | `RuntimeInstance`          | 组件 detached 后触发（对应 `lifetimes.detached`）。            |
| `onRouteDone`     | `PageFeatures`             | 页面路由动画完成时触发（微信官方基础库 `2.31.2+`）。           |

## 8. 示例：滚动 + 分享（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { onPageScroll, onShareAppMessage, onShow, ref } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
const scrollTop = ref(0)

onShow(() => {
  console.log('page show')
})

onPageScroll((e) => {
  scrollTop.value = e.scrollTop
})

onShareAppMessage(() => ({
  title: 'wevu 页面分享',
  path: '/pages/index/index',
}))
</script>

<template>
  <view>scrollTop: {{ scrollTop }}</view>
</template>
```

```vue [JavaScript]
<script setup>
import { onPageScroll, onShareAppMessage, onShow, ref } from 'wevu'

const scrollTop = ref(0)

onShow(() => {
  console.log('page show')
})

onPageScroll((e) => {
  scrollTop.value = e.scrollTop
})

onShareAppMessage(() => ({
  title: 'wevu 页面分享',
  path: '/pages/index/index',
}))
</script>

<template>
  <view>scrollTop: {{ scrollTop }}</view>
</template>
```

:::
