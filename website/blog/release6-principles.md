---
title: Weapp-vite@6 原理拆解：编译链路与 Wevu 运行时
description: 这篇文档集中整理 Weapp-vite@6 的实现原理，包括 Vue SFC 编译流程、Wevu 运行时更新机制、宏处理、Rolldown 构建收益和 createRenderer 取舍。
keywords:
  - Weapp-vite
  - Wevu
  - Vue SFC
  - 编译原理
  - release6
  - blog
date: 2026-03-02
---

# Weapp-vite@6 原理拆解：编译链路与 Wevu 运行时

这篇是给想看“为什么这么设计”的同学准备的。

如果你更关心上手和使用场景，建议先看发布文：[`重走 Vue 长征路 Weapp-vite：原生模式之外，多一种 Vue SFC 选择`](/blog/release6)。

## Wevu 和 Vue 3：相同与不同

虽然 Wevu 的 API 设计与 Vue 3 高度一致，但由于运行环境不同，底层实现有本质区别。

| 对比维度   | Vue 3                      | Wevu                      |
| :--------- | :------------------------- | :------------------------ |
| 运行环境   | Web 浏览器                 | 微信小程序                |
| 响应式系统 | Proxy + effect             | Proxy + effect（同源）    |
| 渲染目标   | DOM 节点                   | 小程序页面/组件实例       |
| 渲染方式   | Virtual DOM Diff → DOM API | Snapshot Diff → `setData` |
| 数据模型   | VNode 树                   | 纯 JS 对象快照            |
| 更新机制   | 异步调度 + DOM 操作        | 异步调度 + `setData`      |
| 生命周期   | onMounted/onUpdated 等     | 映射到小程序生命周期      |
| 事件系统   | DOM 事件                   | 小程序 bind/catch 事件    |
| SFC 编译   | @vitejs/plugin-vue         | Weapp-vite 内置           |

### 响应式系统为什么能“同写法”

Vue 3 和 Wevu 在响应式 API 层面是同构体验，`ref`、`computed`、`watch`、`watchEffect` 等都可以按 Vue 3 习惯使用。

```ts
import { computed, ref, watch } from 'wevu'

const count = ref(0)
const doubled = computed(() => count.value * 2)

watch(count, (val) => {
  console.log('count changed:', val)
})
```

### 渲染机制为什么不同

Vue 3 更新路径是：

```text
状态变化 -> effect 触发 -> 组件更新 -> VNode Diff -> DOM 操作
```

Wevu 更新路径是：

```text
状态变化 -> effect 触发 -> 快照 Diff -> setData -> 小程序渲染
```

Wevu 会对响应式数据快照做差异计算，尽量把 `setData` payload 控制在最小范围，减少无关路径更新。

## Vue SFC 到小程序四件套：编译链路

`MyComponent.vue` 会被编译为：

```text
MyComponent.vue
    ├─> MyComponent.js
    ├─> MyComponent.wxml
    ├─> MyComponent.wxss
    └─> MyComponent.json
```

核心流程如下：

```text
.vue 文件
  ↓
vue/compiler-sfc 解析
  ↓
┌─────────┬─────────┬─────────┐
│ <script>│<template>│<style>  │
└────┬────┴────┬────┴────┬────┘
     │         │         │
     ↓         ↓         ↓
  处理宏    指令转换   样式转换
     │         │         │
     └─────────┴─────────┘
               ↓
         生成四件套
         .js .wxml .wxss .json
```

增量构建阶段会利用缓存，只处理变更文件，这是 HMR 能稳定反馈的基础。

## 宏与配置合并：为什么推荐 `defineXxxJson`

Weapp-vite 提供：

- `defineAppJson`
- `definePageJson`
- `defineComponentJson`

这些宏会在编译阶段提取参数并合并到生成的 `.json` 文件，运行时没有额外开销。

和 `<json>` 块相比，宏的优势是：

- 类型提示与校验更完整；
- 可以与 `<script setup>` 作用域共享变量；
- 重构和 IDE 辅助更稳定。

## 原生组件如何在 `.vue` 里自动接入

当你在 SFC 中 `import` 原生组件并在模板实际使用后，编译阶段会自动补齐 `usingComponents` 映射，避免手写重复配置。

这让 Vue SFC 和原生组件生态能在同一工程里更平滑协作。

## 插槽处理：不是简单文本替换

编译阶段会按小程序 slot 语义进行转换：

- 默认插槽与具名插槽按小程序 slot 结构输出；
- `<template #name>` 会转为对应 slot 节点；
- 含作用域参数的插槽会走 scoped slot 相关编译逻辑。

所以这部分是“语义映射 + 代码生成”，不是把模板字符串原样替换。

## 构建内核升级：Rolldown 带来的收益

v6 演进中，Weapp-vite 构建链路逐步切换到 Rolldown 内核，并继续保持对现有插件生态的兼容能力。

在中大型项目里，体感改进主要是：

- 冷启动更快；
- 增量构建更灵敏；
- 依赖规模较大时构建波动更小。

## 为什么没有把 `createRenderer` 作为主实现

`@vue/runtime-core` 的 `createRenderer` 是技术上可行的方案，但 Wevu 主线没有采用它，核心是抽象边界不对齐：

- `createRenderer` 要求宿主提供较完整的节点操作语义；
- 小程序实际更新通道是 `setData(payload)`；
- Wevu 主链路是“编译到 WXML + 快照 diff + 最小 setData”，更贴合小程序性能约束。

相关专题可继续阅读：[`为什么没有使用 @vue/runtime-core 的 createRenderer 来实现`](/wevu/why-not-runtime-core-create-renderer)

## 当前能力范围（概览）

- 核心指令：`v-if`、`v-else`、`v-for`、`v-show`、`v-model`
- 事件绑定：`@click`、`@tap`、自定义事件
- 属性绑定：`:class`、`:style`、动态属性
- 样式处理：CSS Modules、SCSS/Less 等预处理器
- 组件通信：props、emits、provide/inject、slots
- 生命周期：`onMounted`、`onUpdated`、`onUnmounted` 等
- 响应式 API：`ref`、`computed`、`watch`、`watchEffect`
- TypeScript：类型推导与泛型组件支持
