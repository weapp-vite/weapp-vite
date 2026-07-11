---
title: Options API
description: Wevu 支持的 Vue 风格与小程序原生 Options API 清单，以及迁移时需要注意的语义差异。
outline:
  level: [2, 2]
keywords:
  - wevu
  - options api
  - vue migration
  - miniprogram
---

# Options API

Wevu 接受 Vue 风格选项，同时保留小程序 `Component` 的宿主选项。名称相同不代表运行时语义完全相同：组件注册、生命周期时机、props 规范化和更新最终都受小程序宿主约束。

<WevuApiDocPage :group-count="2" />

<!--@include: ../../.partials/wevu-api/options-api/01-vue-风格选项.md-->

<!--@include: ../../.partials/wevu-api/options-api/02-小程序宿主选项.md-->
