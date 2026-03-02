---
title: 重走 Vue 长征路 Weapp-vite：编译链路与 Wevu 运行时原理拆解
description: 这篇文档不是功能清单，而是 Weapp-vite@6 在实现 Vue SFC 支持时的一份技术复盘，重点记录编译链路、运行时更新路径和关键取舍。
keywords:
  - Weapp-vite
  - Wevu
  - Vue SFC
  - 编译原理
  - release6
  - blog
date: 2026-03-02
---

![Weapp-vite 6 顶部海报](/6/bg.jpg)

# 重走 Vue 长征路 Weapp-vite：编译链路与 Wevu 运行时原理拆解

书接上篇

我当时在团队里做[《Vue 编译本质论》](https://deep-in-vue.icebreaker.top/)分享，正好把一些判断过程也整理了下来：为什么这么做，没选什么，以及这些取舍在小程序里到底值不值。

如果你更关心怎么上手，先看发布文会更顺：[`Weapp-vite：原生模式之外，多一种 Vue SFC 选择`](/blog/release6)。

## 先把边界说清：Wevu 不是 Vue 3 的搬运工

Wevu 用起来确实很像 Vue 3，但骨子里不是一回事。

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

说白了就一件事：**响应式 API 长得一样，但最后数据往哪送、怎么送，完全不同**。

## API 为什么能"几乎同写法"

`ref`、`computed`、`watch` 这些在 wevu 里跟 Vue 3 写法一模一样，没必要再造一套 DSL 出来。

```ts
import { computed, ref, watch } from 'wevu'

const count = ref(0)
const doubled = computed(() => count.value * 2)

watch(count, (val) => {
  console.log('count changed:', val)
})
```

很多团队迁过来之后第一反应不是"又要学新东西"，而是"这不就是我平时写的吗，换了个宿主而已"。

## 渲染链路才是真正不一样的地方

Vue 3 走的是这条路：

```text
状态变化 -> effect 触发 -> 组件更新 -> VNode Diff -> DOM 操作
```

Wevu 走的是这条：

```text
状态变化 -> effect 触发 -> 快照 Diff -> setData -> 小程序渲染
```

Wevu 干的事情说穿了就是把"算出哪些东西变了"这一步尽量提前做完，等到真正调 `setData` 的时候，payload 已经被压到最小了。这在小程序里特别关键——大家踩过坑的都知道，`setData` 传多了，页面就卡，尤其是列表页。

## `.vue` 到四件套：编译阶段干了啥

一个 `MyComponent.vue` 最终会变成小程序四件套：

```text
MyComponent.vue
  ├─> MyComponent.js
  ├─> MyComponent.wxml
  ├─> MyComponent.wxss
  └─> MyComponent.json
```

中间的流程大概是这样：先把 SFC 拆成四块——`<script>`、`<template>`、`<style>`、`<json>`，各自按小程序的规矩做转换，最后拼成产物。

其中 `<json>` 块用来声明页面或组件的配置（比如 `usingComponents`、`navigationBarTitleText` 之类的），不过我更推荐用 `definePageJson` / `defineComponentJson` / `defineAppJson` 这几个编译宏来代替它——有类型提示，能跟 `<script setup>` 共享上下文，IDE 重构的时候也不容易漏改。`<json>` 块当兼容手段用没问题，但不太适合当主力。

```text
.vue 文件
  ↓
vue/compiler-sfc 解析
  ↓
┌─────────┬──────────┬─────────┬────────┐
│ <script>│<template>│ <style> │ <json> │
└────┬────┴────┬─────┴────┬────┴───┬────┘
     │         │          │        │
     ↓         ↓          ↓        ↓
  处理宏    指令映射     样式转换  配置提取
     │         │          │        │
     └─────────┴──────────┴────────┘
               ↓
         生成 .js/.wxml/.wxss/.json
```

增量构建的时候只处理改过的文件，HMR 能跑得比较稳也是靠这个缓存策略撑着。

## `defineXxxJson` 宏的用法

上面提到推荐用编译宏来代替 `<json>` 块，这里展开说一下。`defineAppJson`、`definePageJson`、`defineComponentJson` 都是编译期宏，构建时提取合并到对应的 `.json` 文件里，运行时零开销。写起来大概是这样：

```html
<script setup lang="ts">
  definePageJson({
    navigationBarTitleText: '首页',
    usingComponents: {},
  })
</script>
```

好处就是直接写在 `<script setup>` 里，有完整的类型推导，改字段名的时候 IDE 能帮你检查，不会出现"json 里改了但别的地方没跟上"的情况。

## 原生组件与插槽

在 `.vue` 里 import 原生组件之后，构建阶段会看模板里到底用没用到，用到了才往 `usingComponents` 里补。这样就不用手动维护那堆路径配置了，少写少错。

插槽也是类似的思路。你写的是 Vue 的 slot 语法，但输出的时候会按小程序的 slot 语义来生成。作用域插槽稍微复杂一点，背后走的是一套语义映射加代码生成，不是简单的字符串替换能搞定的。

## Rolldown：收益主要体现在日常开发体感

v6 切到 Rolldown 不是为了赶时髦，就是想把开发时的等待再缩短一点。

日常能感受到的主要是三个地方：冷启动快了、改完代码后增量构建更灵敏、项目依赖多的时候不容易抽风。不是那种"跑分暴涨 300%"的故事，更像是每次都省个几百毫秒，积少成多，一天下来体感差挺多的。

## 为什么没走 `createRenderer` 这条路

`@vue/runtime-core` 的 `createRenderer` 技术上能跑通，但拿来对小程序用，会发现抽象层对不上：它要求你提供一套完整的宿主节点操作接口，而小程序这边最核心的更新通道就是 `setData(payload)`，两边的假设不太匹配。

Wevu 选了"编译到 WXML + 快照 diff + 最小 setData"这条路，优化点压在更贴近小程序实际约束的地方。不一定是最优雅的方案，但在真实业务里跑下来更稳当。

展开聊的话内容比较多，单独写了一篇：[`为什么没有使用 @vue/runtime-core 的 createRenderer 来实现`](/wevu/why-not-runtime-core-create-renderer)

## 当前能力范围（截至 release6）

日常开发用到的东西基本都覆盖了：`v-if` / `v-for` / `v-model` 这些核心指令，事件和属性绑定，SCSS/Less 和 CSS Modules，props/emits/slots/provide/inject，生命周期，常用的响应式 API，还有 TypeScript 类型推导和泛型组件。

如果你是从 Vue 3 过来的，写法上基本不用重新学，主要就是记住最后跑的不是浏览器而是小程序。

## 最后

感谢每一位提建议、报 bug、提 PR 的同学。

---

如果 Weapp-vite 帮到了你，欢迎给项目点个 [Star](https://github.com/weapp-vite/weapp-vite)！

Happy Coding! 🚀
