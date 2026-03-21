---
title: 怎么阅读这套教程
description: 用新用户能快速建立心智模型的方式介绍 handbook 的阅读顺序、术语边界，以及遇到问题时该跳去哪里继续查。
keywords:
  - handbook
  - reading guide
  - Weapp-vite
  - Wevu
  - Vue SFC
---

# 怎么阅读这套教程

这套教程不是“从头到尾背下来”的文档，而是一条可以反复来回切换的学习路径。

你可以把它理解成一个训练营：

- 前几章帮你搭好最小工作流
- 中间几章帮你学会日常开发
- 后几章帮你处理复杂项目里的真实问题

## 1. 先记住 4 个关键词

### 1.1 Weapp-vite

`weapp-vite` 是工具链，负责开发、构建、产物输出、工程化能力和很多编译期增强。

比如这些事，主要都属于它的职责：

- `pnpm dev` / `pnpm build`
- 自动路由、自动导入组件
- npm 包构建和兼容
- 产物输出到 `dist`
- Vue SFC 编译接入

### 1.2 Vue SFC 编译链

这里说的不是浏览器里的 Vue Runtime，而是“把 `.vue` 编译成小程序文件”的那条链路。

例如这个文件：

```vue
<!-- pages/profile/index.vue -->
<script setup lang="ts">
definePageJson(() => ({
  navigationBarTitleText: '个人中心',
}))
</script>

<template>
  <view>profile</view>
</template>
```

最终会被拆成近似这样的产物：

```txt
dist/pages/profile/
├─ index.js
├─ index.json
├─ index.wxml
└─ index.wxss
```

### 1.3 Wevu

`wevu` 是运行时。它提供的是：

- `ref` / `computed` / `watch`
- 页面和组件的生命周期 hooks
- `setup()` 风格写法
- 更细粒度的更新与 `setData` diff

一句话记住：

- `.vue` 怎么变成小程序文件，主要看编译链
- 这些响应式值为什么能更新到页面，主要看 `wevu`

### 1.4 handbook

`handbook` 不是字段手册，而是“项目怎么做”的路线图。

它会反复回答这些问题：

- 这一章的能力，什么时候该引入
- 真实项目里推荐怎么分层
- 新用户最容易踩的坑是什么
- 遇到边界问题时，下一步应该跳去看哪类文档

## 2. 推荐阅读路径

### 2.1 路线 A：你想最快跑通一个 demo

按这个顺序读：

1. [30 分钟快速开始](/handbook/getting-started)
2. [目录结构怎么放最顺手](/handbook/project-structure)
3. [先建立 SFC 心智模型](/handbook/sfc/)
4. [为什么要用 Wevu](/handbook/wevu/)

读完这 4 章后，你应该已经能判断：

- 页面应该放在哪
- `.vue` 页面怎么写
- 为什么响应式 API 要从 `wevu` 导入

### 2.2 路线 B：你已经能跑项目，但想把项目做规范

按这个顺序读：

1. [环境变量与配置怎么分层](/handbook/env-and-config)
2. [网络请求与数据层](/handbook/network)
3. [原生能力调用与封装](/handbook/native-apis)
4. [分包与包体策略](/handbook/subpackages)
5. [监控、埋点与线上可观测性](/handbook/observability)

### 2.3 路线 C：你在排查复杂问题

优先看：

1. [调试与排错（按层定位）](/handbook/debugging)
2. [性能与体验优化](/handbook/performance)
3. [参考入口与速查索引](/handbook/reference)

## 3. 每一章该怎么看

阅读每章时，你可以按这 4 个问题去抓重点：

1. 这章解决的是哪一类问题？
2. 我现在项目里是不是已经遇到它了？
3. 最小示例里哪些代码可以直接照着改？
4. 哪些细节要回到 [guide](/guide/)、[config](/config/) 或 [wevu](/wevu/) 再查？

比如你在看“网络请求与数据层”时，不要一上来就问“团队里要不要上 axios 风格封装”，而是先看：

- 请求入口统一放哪里
- 登录态刷新谁负责
- 页面、store、service 的边界怎么分

## 4. 新用户最常见的 5 个误区

### 4.1 误区 1：把 `guide` 当作完整教程

`guide` 更像功能入口。它告诉你“这件事怎么开”，但不会把整条开发链路串起来。

### 4.2 误区 2：把 `wevu` 当成 Web Vue

虽然写法相似，但宿主环境还是小程序。模板、事件、组件树、原生能力约束都不一样。

### 4.3 误区 3：从 `vue` 导入响应式 API

在小程序运行时语义里，日常页面和组件开发应优先从 `wevu` 导入：

```ts
import { computed, ref } from 'wevu'
```

### 4.4 误区 4：一开始就过度抽象

新项目最重要的是先跑通一条完整业务路径，再考虑大而全的通用层。

### 4.5 误区 5：只在 dev 看效果，不看构建产物

很多问题只有在最终产物里才暴露，比如：

- 路径重写不对
- 分包引用错位
- 开发者工具根目录配置不对

## 5. 如果你读到一半卡住了

可以按这个跳转策略继续查：

- 不知道能力开关在哪：回 `/guide`
- 不知道字段怎么配：回 `/config`
- 不知道运行时 API 与语义边界：回 `/wevu`
- 不知道源码是怎么实现的：看 [/handbook/reference](/handbook/reference)

## 6. 速查表

| 你现在的状态       | 建议入口                                            |
| ------------------ | --------------------------------------------------- |
| 第一次接触项目     | [30 分钟快速开始](/handbook/getting-started)        |
| 想补齐项目结构认知 | [目录结构怎么放最顺手](/handbook/project-structure) |
| 想集中学 Vue SFC   | [先建立 SFC 心智模型](/handbook/sfc/)               |
| 想集中学运行时     | [为什么要用 Wevu](/handbook/wevu/)                  |
| 想优先排错         | [调试与排错（按层定位）](/handbook/debugging)       |

## 7. 总结

阅读 handbook 最重要的不是“一口气读完”，而是始终知道自己现在在哪个阶段、下一步该跳去哪里。

建议你现在直接进入下一章：[30 分钟快速开始](/handbook/getting-started)。

## 8. 参考资源

| 主题       | 推荐入口                            |
| ---------- | ----------------------------------- |
| 教程首页   | [从零开始学 Weapp-vite](/handbook/) |
| 配置索引   | [配置总览](/config/)                |
| 运行时索引 | [Wevu 概览](/wevu/)                 |
| 功能用法   | [Guide 总览](/guide/)               |
