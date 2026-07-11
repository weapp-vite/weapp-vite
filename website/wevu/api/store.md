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

以下条目来源于 `packages-runtime/wevu/src/store/index.ts` 的模块导出，以及 `defineStore()` 返回实例和 `createStore()` 返回 Manager 的公共契约。

> Wevu Store 对齐 Pinia 的主要使用心智，但不是 Pinia 的完整实现。`createStore()`、Manager 安装行为、订阅时机和小程序响应式更新均以本页契约为准。

<!--@include: ../../.partials/wevu-api/store/01-核心函数.md-->

<!--@include: ../../.partials/wevu-api/store/02-store-实例-api.md-->

<!--@include: ../../.partials/wevu-api/store/03-store-manager-api.md-->

<!--@include: ../../.partials/wevu-api/store/04-options-store-配置.md-->

<!--@include: ../../.partials/wevu-api/store/05-store-类型.md-->
