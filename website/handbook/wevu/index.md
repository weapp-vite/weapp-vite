---
title: Wevu 是什么，不是什么
description: 搞清楚 wevu 在这套技术栈里的定位：它负责什么、不负责什么、和 Vue 是什么关系。
keywords:
  - handbook
  - wevu
  - 运行时
---

# Wevu 是什么，不是什么

你在前面的章节里已经用过 `ref`、`computed`、`onLoad` 这些 API 了。它们都来自 `wevu`。

这一章把 wevu 的定位讲清楚，这样你遇到问题的时候能更快判断该往哪个方向查。

## 一句话说清楚

wevu 是小程序的运行时层。它让你能用接近 Vue 3 的方式写响应式状态和生命周期，但底下跑的还是小程序。

## 它负责什么

- 响应式：`ref`、`reactive`、`computed`、`watch`、`watchEffect`
- 生命周期：`onLoad`、`onShow`、`onHide`、`onReady`、`onUnload` 等
- 组件定义：`defineComponent`、`createApp`
- 状态管理：`defineStore`、`storeToRefs`
- 最小化更新：自动做快照 diff，只把变化的部分传给 `setData`
- 双向绑定辅助：`bindModel`、`useBindModel`

## 它不负责什么

- 不负责把 `.vue` 编译成小程序文件（那是 weapp-vite 的事）
- 不负责浏览器 DOM 渲染（小程序没有 DOM）
- 不负责把 Web Vue 的所有能力 1:1 搬过来
- 不负责突破小程序宿主本身的限制

## 和 Vue 是什么关系

wevu 借鉴了 Vue 3 的响应式心智模型，但不是 Vue 3 的子集或移植版。

最大的区别：

- 没有 Virtual DOM。wevu 用快照 diff + `setData` 来更新视图
- 没有浏览器 DOM。模板最终是 WXML，不是 HTML
- 事件是小程序事件，不是标准 DOM Event
- 组件树的行为受小程序宿主约束

如果你把 wevu 理解成"面向小程序约束重新设计的一套 Vue 风格运行时"，会比理解成"Vue 3 的缩小版"更准确。

## 为什么不直接用原生写法

原生小程序的 `Page()` + `setData()` 在简单页面里没问题。但页面一复杂，问题就来了：

```ts
// 原生写法
Page({
  data: { count: 0, loading: false, list: [] },
  onLoad() { this.fetchList() },
  async fetchList() {
    this.setData({ loading: true })
    const list = await request({ url: '/api/products' })
    this.setData({ loading: false, list })
  },
})
```

状态散在 `data` 里，逻辑复用困难，生命周期和副作用越来越难拆。

用 wevu 的话，同样的逻辑可以抽成 composable：

```ts
import { onLoad, ref } from 'wevu'

export function useProductList() {
  const list = ref([])
  const loading = ref(false)

  async function fetchList() {
    loading.value = true
    try {
      list.value = await request({ url: '/api/products' })
    }
    finally {
      loading.value = false
    }
  }

  onLoad(fetchList)
  return { list, loading, fetchList }
}
```

状态和副作用可以抽出去、可以复用、可以测试。这是 wevu 最核心的价值。

## 什么时候可以不用

如果页面极度简单（纯展示、几乎没有交互），不用 wevu 也行。关键不是"必须到处用"，而是当页面复杂度上来的时候，wevu 能让代码结构更稳。

## 接下来

- [响应式和生命周期](/handbook/wevu/runtime) — 理解 setup、hooks 和页面更新机制
- [组件通信](/handbook/wevu/component) — props、emit、slots
- [状态管理](/handbook/wevu/store) — 什么时候该上 store
