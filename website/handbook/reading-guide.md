---
title: 阅读路线与约定
description: handbook 的阅读路线与术语约定，帮助你区分 weapp-vite、Vue SFC 编译链与 Wevu 运行时各自负责的边界。
keywords:
  - handbook
  - reading
  - guide
  - 阅读路线与约定
  - Weapp-vite
  - Wevu
  - Vue SFC
---

# 阅读路线与约定

## 术语说明

- **Weapp-vite**：开发/构建工具链，把你的源码编译成小程序能运行的产物。
- **wuve（本文用法）**：不是独立 npm 包；指 _weapp-vite 内置的 Vue SFC 编译链路_，把 `.vue` 编译成 WXML/WXSS/JS/JSON。
- **Wevu**：运行时库，提供 Composition API、生命周期 hooks、快照 diff，尽量少调用 `setData`。

## 先看哪一套文档

- 想知道命令怎么跑、能力在哪开：先看 `/guide/`
- 想知道配置字段、默认值、适用场景：看 `/config/`
- 想系统理解 Vue SFC 与 Wevu：看 `/wevu/`
- 想按学习路径串起来：继续看 `/handbook/`

## 这套教程的组织方式

每章尽量遵循固定结构，方便扫读与检索：

- 本章你会学到什么
- 前置条件
- 最小可运行示例（或伪代码 + 关键片段）
- 边界情况与常见坑
- 相关链接（跳转到仓库现有文档/源码）

## 版本与兼容性提示

- Vue SFC 支持以 `weapp-vite@6.x` 及以上版本为主线。
- 若项目同时安装 `weapp-vite` 与 `wevu`，请保持两者版本号一致（例如 `weapp-vite@x.y.z` 与 `wevu@x.y.z`）。
- Node.js 版本以 `packages/weapp-vite/package.json` 的 `engines.node` 为准（当前为 `^20.19.0 || >=22.12.0`）。
- 小程序能力和基础库版本强相关：涉及分享、朋友圈、收藏、worker 等能力时，请以官方文档为准，并做真机验证。

## 示例与“能不能用”的判断原则

- **先看文档**：`/wevu/vue-sfc`、`/wevu/compatibility`、`/config/`。
- **再看源码**：SFC 模板编译与 `v-model` 映射逻辑在 `packages/weapp-vite/src/plugins/vue/`。
- **最后以运行时为准**：小程序模板/样式/事件限制比 Web 更严格，遇到边界问题以微信实际行为为准。
