---
title: Lifecycle API
description: 本页仅覆盖 wevu 实际导出的生命周期 Hook（源码：runtime/hooks.ts），并补充与小程序 lifetimes/pageLifetimes 的映射说明。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - lifecycle
  - hooks
---

# Lifecycle API（生命周期）

以下条目严格对应 `packages-runtime/wevu/src/runtime/hooks.ts` 的导出函数。所有 Hook 都要求在 `setup()` 同步阶段调用。

<!--@include: ../../.partials/wevu-api/lifecycle/01-app-生命周期-hook.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/02-页面生命周期-hook.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/03-页面事件-hook.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/04-返回值型页面-hook.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/05-组件扩展-hook.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/06-vue-语义对齐-hook.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/07-小程序原生生命周期映射说明.md-->

<!--@include: ../../.partials/wevu-api/lifecycle/08-示例.md-->
