---
title: 组件：props/emit/slots 语义
description: 组件：props/emit/slots 语义，聚焦 handbook / Wevu 相关场景，覆盖 Weapp-vite 与 Wevu
  的能力、配置和实践要点。
keywords:
  - Wevu
  - 微信小程序
  - handbook
  - component
  - 组件：props/emit/slots
  - 语义
  - 聚焦
  - /
---

# 组件：props / emit / slots 语义

## 本章你会学到什么

- props 从哪里来（`properties` vs `props`）
- emit 如何映射到小程序 `triggerEvent`
- slots 在小程序里的真实语义

## props：优先理解为小程序 properties

- 你可以直接写原生 `properties`
- 也可以写 Vue 风格 `props`（会转换为 `properties`）

详细对照表：`/wevu/component`

## emit：只有一个 detail

小程序事件只有一个 `detail` 载荷；因此在 Wevu 里要把需要的字段放在 `detail` 里。

## slots：以小程序能力为准

小程序 slot 能力与 Vue slot 不完全等价；如果你在组件封装里高度依赖复杂的作用域插槽，需要提前做可行性评估与替代设计。
