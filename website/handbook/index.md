---
title: 从零开始学 Weapp-vite
description: handbook 按新用户的真实学习顺序组织 Weapp-vite、Vue SFC 与 Wevu，帮助你从项目启动一路走到页面开发、业务落地与上线发布。
keywords:
  - Weapp-vite
  - Wevu
  - Vue SFC
  - handbook
  - 教程
  - 学习路径
---

# 从零开始学 Weapp-vite

如果你是第一次接触 `weapp-vite`，最容易卡住的通常不是“不会配某个字段”，而是：

- 不知道应该先看 `guide`、`config`、`wevu` 还是 `handbook`
- 不确定 `weapp-vite`、Vue SFC、`wevu` 三者分别负责什么
- 能把项目跑起来，但一写页面、一拆组件、一做请求就开始乱

`/handbook` 这套教程就是专门解决这个问题的。它不打算把所有 API 平铺直叙地罗列一遍，而是按“一个新用户真的会怎么学、怎么做项目”的顺序，把核心能力串成一条可执行路径。

## 1. 这套教程解决什么问题

| 你现在的困惑                     | handbook 想给你的答案                                  |
| -------------------------------- | ------------------------------------------------------ |
| 我应该先看哪套文档？             | 先用教程建立顺序感，再回到专题页查细节                 |
| 三层能力分别负责什么？           | 先分清编译期、运行时、业务代码的边界                   |
| 页面能跑，但项目越写越乱怎么办？ | 按“项目启动 → SFC → Wevu → 业务 → 上线”逐步收口        |
| 碰到具体问题时应该跳去哪里？     | 每章都给你对应的 `/guide`、`/config`、`/wevu` 跳转入口 |

你可以先把整条学习路径理解为 5 个阶段：

1. 先把项目跑起来。
2. 再学会怎么写页面和组件。
3. 再理解运行时为什么这样工作。
4. 然后把导航、请求、分包和原生能力做扎实。
5. 最后再处理调试、性能、发布和迁移。

## 2. 先建立一个最小认知模型

你可以先把整个技术栈理解成三层：

```txt
你写的业务代码
├─ .vue 页面 / 组件
├─ services / stores / utils
└─ app.json / page.json / 路由配置

Weapp-vite 负责：开发、构建、扫描、输出产物
Vue SFC 编译链负责：把 .vue 拆成 WXML / WXSS / JS / JSON
Wevu 负责：响应式、生命周期、setup 语义、最小化 setData
```

对应到一个最小页面，大概就是这样：

```vue
<script setup lang="ts">
import { ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: 'Hello Weapp-vite',
}))

const count = ref(0)
</script>

<template>
  <view class="page">
    <text>count: {{ count }}</text>
    <button @tap="count += 1">
      加一
    </button>
  </view>
</template>
```

上面这段代码背后实际发生的是：

- `weapp-vite` 负责 dev/build、目录扫描、输出 `dist`
- SFC 编译链把 `.vue` 转成小程序能识别的四件套
- `wevu` 让 `ref()`、事件绑定和页面更新在小程序里工作起来

## 3. 这套教程怎么读最顺

### 3.1 想最快上手

按下面顺序看：

1. [30 分钟快速开始](/handbook/getting-started)
2. [目录结构怎么放最顺手](/handbook/project-structure)
3. [先建立 SFC 心智模型](/handbook/sfc/)
4. [为什么要用 Wevu](/handbook/wevu/)
5. [页面跳转与路由参数](/handbook/navigation)

### 3.2 已经有项目，想系统补齐认知

可以按 sidebar 的 5 个阶段顺着读：

- 第 1 步：把项目、构建、配置跑顺
- 第 2 步：把 Vue SFC 写顺手
- 第 3 步：把 Wevu 的运行时边界搞明白
- 第 4 步：把导航、请求、原生能力、分包做扎实
- 第 5 步：把调试、性能、发布、迁移收口

## 4. `/guide`、`/config`、`/wevu`、`/handbook` 分别看什么

很多新用户都会在这四类文档之间反复跳。可以这样区分：

| 文档分区    | 最适合解决的问题                                 | 典型页面                                                               |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `/guide`    | 这个能力怎么开、怎么用                           | [自动路由](/guide/auto-routes)、[插件开发](/guide/plugin)              |
| `/config`   | 这个配置项是什么、默认值是什么、应该怎么配       | [subpackages](/config/subpackages)、[routeRules](/config/route-rules)  |
| `/wevu`     | 运行时能力本身是什么、API 边界是什么             | [Wevu 概览](/wevu/)、[API 首页](/wevu/api/)                            |
| `/handbook` | 我第一次做项目时，应该按什么顺序把这些能力串起来 | [快速开始](/handbook/getting-started)、[参考索引](/handbook/reference) |

举个例子，如果你在做一个“商品列表页 + 购物车”的小程序：

- 想知道自动路由怎么开，看 [/guide/auto-routes](/guide/auto-routes)
- 想知道分包字段怎么写，看 [/config/subpackages](/config/subpackages)
- 想知道 `ref`、`computed`、生命周期来自哪里，看 [/wevu/](/wevu/)
- 想知道整个页面应该怎么分层、什么时候拆 store、什么时候做分包，就看 [/handbook/](/handbook/)

## 5. 你能在 handbook 里获得什么

- 一条按真实开发顺序组织的学习路线
- 更偏“怎么做项目”的解释，而不是只讲单点功能
- 每章都会尽量给出最小示例，帮你判断“什么时候该这样写”
- 遇到细节问题时，会指回更准确的 `/guide`、`/config`、`/wevu` 页面

## 6. 现在就从哪里开始

- 完全第一次接触：看 [怎么阅读这套教程](/handbook/reading-guide)
- 想马上跑一个页面：看 [30 分钟快速开始](/handbook/getting-started)
- 你最关心 Vue 写法：从 [先建立 SFC 心智模型](/handbook/sfc/) 开始
- 你最关心运行时：从 [为什么要用 Wevu](/handbook/wevu/) 开始

## 7. 总结

`handbook` 的价值不在于“把所有知识一次讲完”，而在于帮你先建立顺序感，再把专题文档串起来。

如果你现在只做一件事，建议直接进入 [30 分钟快速开始](/handbook/getting-started)。

## 8. 参考资源

| 主题       | 推荐入口                                    |
| ---------- | ------------------------------------------- |
| 项目启动   | [快速开始](/guide/)                         |
| 教程导读   | [怎么阅读这套教程](/handbook/reading-guide) |
| 运行时总览 | [Wevu 概览](/wevu/)                         |
| 配置索引   | [配置总览](/config/)                        |
