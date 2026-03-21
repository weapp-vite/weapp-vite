---
title: API 参考（旧路径兼容）
description: /wevu/api-reference/ 为兼容旧链接保留；当前 Wevu API 的规范入口已经迁移到 /wevu/api/。
sidebar: false
keywords:
  - wevu
  - api
  - api-reference
  - 兼容路径
---

# Wevu API 参考（旧路径兼容）

`/wevu/api-reference/` 这条路径当前仅用于兼容旧链接与历史搜索结果。

## 1. 当前规范入口

当前请统一使用新的 API 首页：

- [Wevu API](/wevu/api/)

## 2. 为什么要切换到新路径

| 原因         | 说明                                                         |
| ------------ | ------------------------------------------------------------ |
| 信息源更集中 | 新页面是当前维护中的规范入口                                 |
| 减少双轨漂移 | 避免 `/wevu/api-reference/*` 与 `/wevu/api/*` 内容长期不一致 |
| 站内导航一致 | 当前 sidebar、索引与后续维护都以 `/wevu/api/*` 为准          |

## 3. 迁移建议

如果你在旧文档、笔记或项目内部链接里还使用了 `/wevu/api-reference/*`，建议逐步替换为：

- `/wevu/api/core`
- `/wevu/api/reactivity`
- `/wevu/api/lifecycle`
- `/wevu/api/setup-context`
- `/wevu/api/store`
- `/wevu/api/runtime-bridge`
- `/wevu/api/types`

## 4. 参考资源

| 主题       | 推荐入口                    |
| ---------- | --------------------------- |
| API 首页   | [Wevu API](/wevu/api/)      |
| 运行时总览 | [Wevu 概览](/wevu/)         |
| 高阶路由   | [wevu/router](/wevu/router) |
