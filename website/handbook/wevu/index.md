---
title: 为什么要用 Wevu
description: 从新用户最关心的角度解释 Wevu 的定位、价值和边界，帮助你判断什么时候该直接写原生，什么时候适合进入 Wevu 运行时范式。
keywords:
  - handbook
  - wevu
  - 运行时
  - 为什么要用 Wevu
---

# 为什么要用 Wevu

很多人第一次接触 `wevu` 时会问：

- 它和 Vue 是什么关系？
- 它到底是不是 runtime？
- 我已经有小程序原生 Page/Component 了，为什么还要引入它？

这章就回答这几个问题。

## 1. 先给一句非常实用的定义

`wevu` 是小程序运行时层。
它让你能用接近 Vue 3 的方式写响应式状态、组合逻辑和生命周期，同时仍然运行在小程序宿主里。

也就是说，它解决的是：

- 状态怎么组织
- 更新怎么同步到视图
- 页面和组件逻辑怎么写得更像现代前端

而它不解决的是：

- 小程序宿主本身的能力边界
- 你模板最终要遵守的 WXML 约束
- 所有 Web Vue 能力 1:1 原样照搬

## 2. 为什么新项目通常值得用 Wevu

### 2.1 原生写法在中小项目很快会变得难维护

例如一个原生页面常见会变成这样：

```ts
Page({
  data: {
    count: 0,
    loading: false,
    list: [],
  },
  onLoad() {
    this.fetchList()
  },
  async fetchList() {
    this.setData({ loading: true })
    const list = await request({ url: '/api/products' })
    this.setData({
      loading: false,
      list,
    })
  },
})
```

当页面复杂起来以后，问题就会变成：

- 状态散在 `data` 里
- 组合逻辑复用困难
- 生命周期和副作用越来越难拆

### 2.2 Wevu 能把这些逻辑变得更可组合

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

  return {
    list,
    loading,
    fetchList,
  }
}
```

这样做的价值是：

- 状态和副作用可以抽出去
- 页面逻辑可以按功能拆
- 复杂业务更容易做模块化

## 3. 它和 Vue Web 最大的区别是什么

### 3.1 没有浏览器 DOM

页面最终还是小程序模板和渲染机制，不是浏览器。

### 3.2 没有完整的 Virtual DOM 路线

Wevu 重点在于更合适的小程序运行时更新方式，而不是把 Web Vue 的整套宿主语义照搬过来。

### 3.3 事件、组件树、原生能力仍然受小程序约束

比如：

- 事件载荷以小程序事件对象为准
- 某些组件通信模式会有宿主边界
- 原生 API 使用方式仍要遵守小程序平台规则

## 4. 什么时候推荐用 Wevu

下面这些情况通常都很适合：

- 页面状态较多，已经有明显的组合逻辑
- 你希望大量使用 `setup` 风格开发
- 你需要把状态逻辑抽到 composable/store 里复用
- 团队已经习惯现代 Vue 3 的组织方式

## 5. 什么时候可以先不用

如果你的页面极度简单，比如一个纯展示页、一个只含少量静态逻辑的落地页，直接用更轻的写法也可以。

关键不是“必须 everywhere 都用”，而是：

> 当页面和组件复杂度开始上升时，Wevu 能让代码结构更稳定。

## 6. 一个典型页面会怎么写

```vue
<script setup lang="ts">
import { computed, onLoad, ref } from 'wevu'

const count = ref(0)
const doubled = computed(() => count.value * 2)

onLoad(() => {
  console.log('page loaded')
})
</script>

<template>
  <view>
    <text>{{ count }}</text>
    <text>{{ doubled }}</text>
  </view>
</template>
```

这里你可以看到它最核心的价值：

- 状态写法统一
- 生命周期在 `setup` 语义里组织
- 页面逻辑更接近现代前端的认知方式

## 7. 速查表

| 问题               | 建议答案                                         |
| ------------------ | ------------------------------------------------ |
| Wevu 是什么        | 小程序运行时层，不是浏览器 Vue Runtime           |
| 它主要解决什么     | 响应式状态、组合逻辑、生命周期与最小化更新       |
| 什么时候值回票价   | 页面复杂度提升、逻辑开始复用、团队偏向组合式开发 |
| 什么时候可以先不用 | 纯展示页、超轻逻辑页、临时落地页                 |

## 8. 建议你怎么继续学 Wevu

不要先死记 API。
更好的顺序是：

1. 先理解运行时是怎么更新页面的
2. 再看组件通信和 store 怎么落地
3. 再看双向绑定、依赖注入、插件这些扩展能力

接下来建议继续看：

- [运行时：setup、hooks 与更新](/handbook/wevu/runtime)
- [组件：props、emit、slots](/handbook/wevu/component)
- [Store：状态怎么放更合理](/handbook/wevu/store)

## 9. 参考资源

| 主题         | 推荐入口                                 |
| ------------ | ---------------------------------------- |
| 运行时总览   | [/wevu/](/wevu/)                         |
| API 总览     | [/wevu/api/](/wevu/api/)                 |
| Vue SFC 总览 | [/handbook/sfc/](/handbook/sfc/)         |
| 调试与排错   | [/handbook/wevu/faq](/handbook/wevu/faq) |
