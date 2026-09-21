---
title: Store API
description: 本页覆盖 wevu/store 的入口函数、Store 实例 API、Manager、Options Store 配置及公开类型。
outline:
  level: [2, 2]
keywords:
  - Wevu
  - api
  - store
---

# Store API（状态管理）

以下条目来源于 `packages-runtime/wevu/src/store/index.ts` 的模块导出，以及 `defineStore()` 返回实例和 `createPinia()` 返回 Pinia 的公共契约。

> 日常 API 与行为以 Pinia 4.0.3 为参照，运行时使用 wevu 响应式。先安装 Pinia 或显式传入实例；支持基础插件上下文。不提供 Web SSR、Pinia HMR 或 Vue Devtools。迁移步骤见 [Store 指南](/wevu/store#从旧版迁移)。

<!--@include: ../../.partials/wevu-api/store/01-核心函数.md-->

<!--@include: ../../.partials/wevu-api/store/02-store-实例-api.md-->

<!--@include: ../../.partials/wevu-api/store/03-store-manager-api.md-->

<!--@include: ../../.partials/wevu-api/store/04-options-store-配置.md-->

<!--@include: ../../.partials/wevu-api/store/05-store-类型.md-->
