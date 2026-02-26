---
title: 迁移指南（路线与清单）
description: 迁移指南（路线与清单），聚焦 handbook / migration 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - 迁移指南
  - handbook
  - migration
  - 迁移指南（路线与清单）
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# 迁移指南（路线与清单）

## 本章你会学到什么

- 从原生小程序迁移到 weapp-vite + SFC 的推荐顺序
- 从“只工程化”到“逐步 Vue 化”的落地路线

## 建议迁移路线（最稳）

1. **先接入 weapp-vite**：不改业务，只换构建与开发体验（参考 `/guide/manual-integration`）。
2. **先迁移工具层**：别名、npm 策略、自动路由、图片优化等（参考 `/guide/`）。
3. **挑一个页面试点 Vue SFC**：把模板/样式/配置放进 `.vue`，运行时用 `wevu`（参考 `/wevu/vue-sfc` 与本教程 SFC 章节）。
4. **抽通用组件与 service/store**：形成可复用的工程分层。
5. **逐步扩大覆盖面**：每次只迁移一个模块，保证回滚成本可控。

## 相关链接

- 版本迁移：`/migration/`
