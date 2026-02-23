---
title: Lifecycle API
---

# Lifecycle API（生命周期）

`wevu` 生命周期 API 都需要在 `setup()` 的同步阶段调用。

## 1. App 生命周期

| API                                                                      | 类型入口                                                          | 说明                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------- |
| [`onLaunch`](/wevu/api/index/functions/onLaunch)                         | [`DefineAppOptions`](/wevu/api/index/interfaces/DefineAppOptions) | 小程序 App 启动。          |
| [`onShow`](/wevu/api/index/functions/onShow)                             | [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)             | App 进入前台。             |
| [`onHide`](/wevu/api/index/functions/onHide)                             | [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)             | App 进入后台。             |
| [`onError`](/wevu/api/index/functions/onError)                           | [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)             | 运行时错误回调。           |
| [`onPageNotFound`](/wevu/api/index/functions/onPageNotFound)             | [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)             | 路由未命中。               |
| [`onUnhandledRejection`](/wevu/api/index/functions/onUnhandledRejection) | [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)             | 未处理 Promise rejection。 |
| [`onThemeChange`](/wevu/api/index/functions/onThemeChange)               | [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)             | 系统主题变化。             |

## 2. 页面与组件通用生命周期

| API                                              | 类型入口                                                        | 说明                       |
| ------------------------------------------------ | --------------------------------------------------------------- | -------------------------- |
| [`onLoad`](/wevu/api/index/functions/onLoad)     | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 页面参数加载（页面常用）。 |
| [`onReady`](/wevu/api/index/functions/onReady)   | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 首次渲染完成。             |
| [`onShow`](/wevu/api/index/functions/onShow)     | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 页面/组件显示。            |
| [`onHide`](/wevu/api/index/functions/onHide)     | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 页面/组件隐藏。            |
| [`onUnload`](/wevu/api/index/functions/onUnload) | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 页面卸载。                 |

## 3. 组件渲染阶段（Vue 风格）

| API                                                              | 类型入口                                                        | 说明                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| [`onBeforeMount`](/wevu/api/index/functions/onBeforeMount)       | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 挂载前。                  |
| [`onMounted`](/wevu/api/index/functions/onMounted)               | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 挂载后。                  |
| [`onBeforeUpdate`](/wevu/api/index/functions/onBeforeUpdate)     | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 更新前。                  |
| [`onUpdated`](/wevu/api/index/functions/onUpdated)               | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 更新后。                  |
| [`onBeforeUnmount`](/wevu/api/index/functions/onBeforeUnmount)   | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 卸载前。                  |
| [`onUnmounted`](/wevu/api/index/functions/onUnmounted)           | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 卸载后。                  |
| [`onActivated`](/wevu/api/index/functions/onActivated)           | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 激活（缓存场景）。        |
| [`onDeactivated`](/wevu/api/index/functions/onDeactivated)       | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 失活（缓存场景）。        |
| [`onErrorCaptured`](/wevu/api/index/functions/onErrorCaptured)   | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 捕获子树错误。            |
| [`onServerPrefetch`](/wevu/api/index/functions/onServerPrefetch) | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 兼容 Vue 语义的预取钩子。 |

## 4. 小程序特有页面事件

| API                                                                | 类型入口                                                  | 说明           |
| ------------------------------------------------------------------ | --------------------------------------------------------- | -------------- |
| [`onPageScroll`](/wevu/api/index/functions/onPageScroll)           | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 页面滚动。     |
| [`onPullDownRefresh`](/wevu/api/index/functions/onPullDownRefresh) | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 下拉刷新。     |
| [`onReachBottom`](/wevu/api/index/functions/onReachBottom)         | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 触底事件。     |
| [`onRouteDone`](/wevu/api/index/functions/onRouteDone)             | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 页面路由完成。 |
| [`onTabItemTap`](/wevu/api/index/functions/onTabItemTap)           | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | Tab 点击。     |
| [`onResize`](/wevu/api/index/functions/onResize)                   | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 视图尺寸变化。 |

## 5. 带返回值的页面钩子

| API                                                                | 类型入口                                                  | 说明                   |
| ------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------- |
| [`onShareAppMessage`](/wevu/api/index/functions/onShareAppMessage) | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 自定义转发内容。       |
| [`onShareTimeline`](/wevu/api/index/functions/onShareTimeline)     | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 自定义朋友圈分享内容。 |
| [`onAddToFavorites`](/wevu/api/index/functions/onAddToFavorites)   | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 添加收藏。             |
| [`onSaveExitState`](/wevu/api/index/functions/onSaveExitState)     | [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures) | 离开时保存状态。       |

## 6. 小程序组件扩展生命周期

| API                                            | 类型入口                                                                            | 说明                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- |
| [`onMoved`](/wevu/api/index/functions/onMoved) | [`MiniProgramPageLifetimes`](/wevu/api/index/type-aliases/MiniProgramPageLifetimes) | 组件节点位置变更。                |
| [`onError`](/wevu/api/index/functions/onError) | [`MiniProgramPageLifetimes`](/wevu/api/index/type-aliases/MiniProgramPageLifetimes) | 组件或 App 错误（按上下文桥接）。 |

## 7. 示例：滚动 + 分享（script setup）

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
