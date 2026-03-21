---
title: API 参考
description: Wevu API 参考首页。按 Vue API 风格提供分组导航，先定位能力域，再跳转到对应 API 分页。
sidebar: false
keywords:
  - wevu
  - api
  - reference
  - vue-style
---

# Wevu API 参考

本页参考了 Vue 官方 API 导航方式，但只聚焦 `wevu` 主入口的高频公开 API。

需要特别区分 3 类入口：

- `wevu`：主运行时入口，覆盖响应式、生命周期、组件定义、store 与 setup 辅助能力。
- `wevu/router`：独立路由子入口，提供 `createRouter()` / `useRouter()` / `useRoute()` 等高阶导航能力。
- `wevu/api`、`wevu/fetch`、`wevu/jsx-runtime`、`wevu/compiler`：按能力拆分的其他子路径，不应与 `wevu` 主入口混写。

本目录优先记录“业务开发会直接使用的 API”；`registerApp`、`callHookList`、`mountRuntimeInstance` 一类内部桥接导出虽然存在于包导出面，但不作为常规业务 API 展开说明。

## 全局 API

### 入口与组件定义

- [Core API（入口、组件、宏）](/wevu/api/core.html)
  - `createApp` / `defineComponent` / `createWevuComponent` / `<script setup>` 宏

### 通用调度

- [Reactivity API（响应式与调度）](/wevu/api/reactivity.html)
  - `ref` / `reactive` / `computed` / `watch` / `nextTick`

## 组合式 API

### 生命周期

- [Lifecycle API（生命周期）](/wevu/api/lifecycle.html)
  - `onLoad` / `onShow` / `onReady` / `onUnload`

### setup 上下文

- [Setup Context API（setup 上下文）](/wevu/api/setup-context.html)
  - `ctx.emit` / `useBindModel` / `useDisposables` / `usePageLayout` / `provide` / `inject`

### 状态管理

- [Store API（状态管理）](/wevu/api/store.html)
  - `defineStore` / `createStore` / `storeToRefs`

## 进阶 API

### 运行时桥接

- [Runtime Bridge API（桥接与调试）](/wevu/api/runtime-bridge.html)
  - `setWevuDefaults` / `markNoSetData` / mutation recorder / 运行时调试开关

### 类型与工具

- [Type Reference（类型总览）](/wevu/api/types.html)
  - 核心类型、上下文类型、Store 类型、桥接类型

## 弃用与兼容保留 API

当前基于源码 `@deprecated` 标记，`wevu` 主入口里已明确弃用的公开 API 有：

- `provideGlobal()` / `injectGlobal()`
  - 仅为兼容旧代码保留
  - 新代码请优先使用 `provide()` / `inject()`
  - 若需要稳定全局共享，优先使用 store

详情见：

- [/wevu/api/setup-context#provideglobal](/wevu/api/setup-context#provideglobal)
- [/wevu/api-reference/setup-context](/wevu/api-reference/setup-context)

## 其他子路径入口

这些页面不属于 `wevu` 主入口的逐函数 API 参考，但它们同样是当前包的正式子路径导出：

- [wevu/api](/wevu/api-package)
  - 透传 `@wevu/api`，用于统一多端小程序 API 调用
- [wevu/fetch](/wevu/fetch)
  - 基于 `wpi.request` 的 Fetch 风格接口
- [wevu/router](/wevu/router)
  - 高阶导航、守卫、失败分类、`useRoute()` / `useRouter()`
- [wevu/jsx-runtime](/wevu/jsx-runtime)
  - TSX / JSX 类型入口

## 建议阅读路径

1. 先读 `Core`，建立 Wevu 的组件与宏心智。
2. 再读 `Reactivity` + `Lifecycle`，形成页面更新与生命周期调度模型。
3. 业务接入 `Setup Context` + `Store`。
4. 需要排障或优化时再进入 `Runtime Bridge` 与 `Type Reference`。

## 使用约定

- 根入口运行时 API 默认从 `wevu` 导入。
- 路由能力请从 `wevu/router` 导入，不要把它与根入口原生 Router helper 混淆。
- `wevu/compiler` 主要用于编译工具链，不建议在业务运行时代码中直接依赖。
- 本目录是“按场景组织”的人工参考；精确签名、泛型和重载以对应 API 分页为准。
