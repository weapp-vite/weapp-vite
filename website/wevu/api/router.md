---
title: Wevu Router API
description: wevu/router 完整 API 参考，覆盖入口函数、Router 实例、导航守卫、动态路由和公开类型。
outline:
  level: [2, 2]
keywords:
  - wevu/router
  - createRouter
  - useRouter
  - Vue Router
  - 小程序路由
---

# Wevu Router API

本页对应 `wevu/router` 的公开导出，以及 `createRouter()` 返回实例的公共契约。Wevu Router 对齐 Vue Router 的主要使用心智，但最终导航仍受小程序页面栈、tabBar 和宿主 API 约束。

> `createRouter()`、`useRouter()` 和 `useRoute()` 依赖同步 setup 时序；`currentRoute` 是 readonly 响应式对象而不是 `Ref`，`isReady()` 创建后立即完成。这里没有 Web history、`RouterView` 或 `RouterLink`，hash-only、正向历史和 tabBar query 也不能按浏览器语义理解。

```ts
import { createRouter, useRoute, useRouter } from 'wevu/router'
```

<!--@include: ../../.partials/wevu-api/router/01-router-入口.md-->

<!--@include: ../../.partials/wevu-api/router/02-原生-router.md-->

<!--@include: ../../.partials/wevu-api/router/03-解析与导航失败.md-->

<!--@include: ../../.partials/wevu-api/router/04-router-实例.md-->

<!--@include: ../../.partials/wevu-api/router/05-导航方法.md-->

<!--@include: ../../.partials/wevu-api/router/06-动态路由.md-->

<!--@include: ../../.partials/wevu-api/router/07-导航守卫.md-->

<!--@include: ../../.partials/wevu-api/router/08-兼容边界.md-->
