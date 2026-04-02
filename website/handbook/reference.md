---
title: 参考入口与速查索引
description: 帮你在遇到具体问题时，快速判断应该回到 guide、config、wevu 还是源码，避免在文档体系里来回迷路。
keywords:
  - handbook
  - reference
  - 索引
  - 参考入口
---

# 参考入口与速查索引

当你已经顺着 handbook 学了一轮，后面最需要的往往不是“再看一遍教程”，而是：

> 现在这个具体问题，我应该回去哪一类文档查？

这页就是为这个目的准备的。

## 1. 先按问题类型找入口

### 1.1 我想知道某个功能怎么开启

去：

- [/guide/](/guide/)

例如：

- 自动路由
- 自动导入组件
- npm 构建
- WXML/WXS 增强

### 1.2 我想知道某个字段怎么配

去：

- [/config/](/config/)

例如：

- 分包
- Route Rules
- WXML/WXS 配置
- npm 配置

### 1.3 我想知道运行时能力边界

去：

- [/wevu/](/wevu/)
- [/wevu/api/](/wevu/api/)

例如：

- 生命周期
- 组件通信
- store
- runtime bridge

### 1.4 我想知道项目应该怎么组织

回：

- [/handbook/](/handbook/)

例如：

- 目录分层
- 页面跳转
- 请求层组织
- 上线前检查

## 2. 这一页也给你一个“源码地图”

当文档还不够时，可以继续看源码。
这时候最重要的不是“把整个仓库翻一遍”，而是知道先从哪里进。

### 2.1 想看 Vue SFC 编译相关

优先关注：

- `packages/weapp-vite/src/plugins/vue/`

### 2.2 想看 Wevu 运行时相关

优先关注：

- `packages-runtime/wevu/src/`

### 2.3 想看文档和网站导航组织

优先关注：

- `website/.vitepress/config.ts`

## 3. 一个常见问题到入口的映射表

| 你遇到的问题               | 建议先去哪里                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| 自动路由怎么开             | [/guide/auto-routes](/guide/auto-routes)                                                       |
| 分包字段怎么配             | [/config/subpackages](/config/subpackages)                                                     |
| `v-model` 在小程序里怎么写 | [/handbook/sfc/events-and-v-model](/handbook/sfc/events-and-v-model)                           |
| 页面为什么不更新           | [/handbook/debugging](/handbook/debugging) 和 [/handbook/wevu/runtime](/handbook/wevu/runtime) |
| Wevu 生命周期怎么理解      | [/wevu/api/lifecycle](/wevu/api/lifecycle)                                                     |
| Web 运行时支持到什么程度   | [/guide/web-compat-matrix](/guide/web-compat-matrix)                                           |
| 配置项总览在哪里           | [/config/](/config/)                                                                           |

## 4. 你也可以按“当前阶段”找

### 4.1 我在搭项目

先看：

- [30 分钟快速开始](/handbook/getting-started)
- [目录结构怎么放最顺手](/handbook/project-structure)
- [环境变量与配置怎么分层](/handbook/env-and-config)

### 4.2 我在写页面

先看：

- [先建立 SFC 心智模型](/handbook/sfc/)
- [为什么要用 Wevu](/handbook/wevu/)
- [页面跳转与路由参数](/handbook/navigation)

### 4.3 我在查问题

先看：

- [调试与排错（按层定位）](/handbook/debugging)
- [/troubleshoot/index](/troubleshoot/index)

### 4.4 我在准备上线

先看：

- [性能与体验优化](/handbook/performance)
- [构建、预览与上传](/handbook/publish)
- [监控、埋点与线上可观测性](/handbook/observability)

## 5. 最后一个建议

当你遇到问题时，不要直接在整个文档站里盲搜关键词。
先判断它更像是：

- 功能用法问题
- 配置问题
- 运行时问题
- 项目组织问题

这样你会更快找到正确入口。

## 6. 速查表

| 你要找的东西 | 优先入口                 | 第二入口                                           |
| ------------ | ------------------------ | -------------------------------------------------- |
| 功能开关     | [/guide/](/guide/)       | [/troubleshoot/index](/troubleshoot/index)         |
| 配置字段     | [/config/](/config/)     | [/guide/](/guide/)                                 |
| 运行时 API   | [/wevu/api/](/wevu/api/) | [/wevu/](/wevu/)                                   |
| 教程路线     | [/handbook/](/handbook/) | [/handbook/reading-guide](/handbook/reading-guide) |

## 7. 参考资源

| 主题       | 推荐入口                                    |
| ---------- | ------------------------------------------- |
| 教程导读   | [怎么阅读这套教程](/handbook/reading-guide) |
| 运行时总览 | [Wevu 概览](/wevu/)                         |
| API 总览   | [Wevu API](/wevu/api/)                      |
| 常见问题   | [troubleshoot](/troubleshoot/index)         |
