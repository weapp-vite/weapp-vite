---
title: API 参考
description: Wevu API 参考首页。按 Vue API 风格提供分组导航，先定位能力域，再跳转到对应 API 分页。
sidebar: false
keywords:
  - Wevu
  - api
  - reference
  - vue-style
  - 指南
---

# Wevu API 参考

本页参考了 Vue 官方 API 导航方式：先按能力域分组，再进入具体条目。

## 全局 API

### 入口与应用

- [Core API（入口、组件、宏）](/wevu/api/core.html)
  - `defineComponent` / `createApp` / `defineProps` / `defineEmits` / `defineModel`

### 通用调度

- [Reactivity API（响应式与调度）](/wevu/api/reactivity.html)
  - `ref` / `reactive` / `computed` / `watch` / `nextTick`

## 组合式 API

### 生命周期

- [Lifecycle API（生命周期）](/wevu/api/lifecycle.html)
  - `onLoad` / `onShow` / `onReady` / `onUnload`

### setup 上下文

- [Setup Context API（setup 上下文）](/wevu/api/setup-context.html)
  - `ctx.emit` / `useBindModel` / `getCurrentInstance` / `provide` / `inject`

### 状态管理

- [Store API（状态管理）](/wevu/api/store.html)
  - `defineStore` / `createStore` / `storeToRefs`

## 进阶 API

### 运行时桥接

- [Runtime Bridge API（桥接与调试）](/wevu/api/runtime-bridge.html)
  - 小程序实例桥接、`setData` 策略、调试与性能开关

### 类型与工具

- [Type Reference（类型总览）](/wevu/api/types.html)
  - 核心类型、上下文类型、Store 类型、桥接类型

## 建议阅读路径

1. 先读 `Core`，建立 Wevu 的组件与宏心智。
2. 再读 `Reactivity` + `Lifecycle`，形成页面更新与生命周期调度模型。
3. 业务接入 `Setup Context` + `Store`。
4. 需要排障或优化时再进入 `Runtime Bridge` 与 `Type Reference`。

## 使用约定

- 业务代码统一从 `wevu` 主入口导入。
- `wevu/compiler` 主要用于编译工具链，不建议在业务运行时代码中直接依赖。
- 本目录是“按场景组织”的人工参考；精确签名、泛型和重载以对应 API 分页为准。
