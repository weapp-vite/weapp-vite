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

这个问题被问了太多次了，干脆在这里好好聊聊。

做 Wevu 之前我肯定研究过 `@vue/runtime-core` 的 `createRenderer`，毕竟 Vue 官方就是拿这个来做自定义渲染器的。技术上能不能跑通？能。但我最后没选这条路，不是因为它不好，是因为拿来做小程序，越想越觉得别扭。

`createRenderer` 要你提供一整套节点操作——`patchProp`、`insert`、`remove`、`createElement`、`createText`、`parentNode`、`nextSibling`……这套东西天然就是给"我有一棵节点树，我要增删改查"这种场景设计的。DOM 是这样，Canvas 是这样，Native UI 也是这样。

但小程序不是这样。

小程序的更新通道就一个：`setData(payload)`。你没法去"插入一个节点"或者"删除一个子元素"，你只能告诉它"这些数据变了，你自己去渲染"。这跟 `createRenderer` 假设的那套能力模型，根本就是两个世界的东西。

如果硬要用 `createRenderer`，你就得在小程序上面再模拟一层虚拟的节点树出来，把 renderer 的那些节点操作接进去，最后再把这棵树的变化折叠成 `setData` 调用。等于你凭空多了一层抽象，而这层抽象解决的不是你的问题——你的问题是怎么让 `setData` 的 payload 尽量小、调用尽量少，不是怎么维护一棵节点树。

而且还有个很实际的问题：Wevu 的页面和组件注册直接走的是小程序的 `App()` / `Component()`，生命周期也是围绕这些来的。实例边界天然就是小程序实例，不是 renderer 那套"容器 + vnode root"。编译产物也是"小程序模板 + 运行时桥接代码"，不是给 renderer 跑的 vnode render 函数。要是主架构迁过去，编译器和运行时得一起重写，这个成本太高了。

有人可能会说，Taro 不就是类似的思路吗？一个比较大的 `base.wxml` 加运行时驱动节点树。确实，技术上可行，Wevu 也不是绝对做不了。但在小程序里实际跑下来，运行时要额外维护节点映射和协调过程，`base.wxml` 越通用体积越大、模板解析越重，而且到最后还是得落到 `setData`——上面那层抽象并不能帮你绕开这个桥接成本。大部分业务场景下，性能大概率不如直接做快照 diff + 最小 setData。

所以 Wevu 的策略很明确：主线就走"编译到 WXML + 运行时快照 diff + 最小 setData"。`createRenderer` 如果后面想验证，会开个实验分支单独跑，看功能覆盖、更新性能、payload 体积这几个指标。在没跑出明显收益之前，不会动现有链路。

说到底，`createRenderer` 是个很优秀的通用能力，但 Wevu 要解决的是小程序 `setData` 语义下的具体工程问题，这俩不在一个频道上。

更详细的技术分析我单独写了一篇，感兴趣可以看：[为什么没有使用 @vue/runtime-core 的 createRenderer 来实现](/wevu/why-not-runtime-core-create-renderer)

## 当前能力范围（截至 release6）

日常开发用到的东西基本都覆盖了：`v-if` / `v-for` / `v-model` 这些核心指令，事件和属性绑定，SCSS/Less 和 CSS Modules，props/emits/slots/provide/inject，生命周期，常用的响应式 API，还有 TypeScript 类型推导和泛型组件。

如果你是从 Vue 3 过来的，写法上基本不用重新学，主要就是记住最后跑的不是浏览器而是小程序。

## 最后

感谢每一位提建议、报 bug、提 PR 的同学。

---

如果 Weapp-vite 帮到了你，欢迎给项目点个 [Star](https://github.com/weapp-vite/weapp-vite)！

Happy Coding! 🚀
