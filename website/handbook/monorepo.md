---
title: Monorepo 与多包协作
description: Monorepo 与多包协作，聚焦 handbook / monorepo 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - handbook
  - monorepo
  - 与多包协作
  - 聚焦
  - /
  - 相关场景
  - 覆盖
  - weapp-vite
---

# Monorepo 与多包协作

## 本章你会学到什么

- pnpm workspace 下如何组织“业务包/组件库/工具包”
- 本地联调时如何避免依赖与产物错位

## 推荐实践

- 公共能力做成 workspace 包（例如 `@scope/shared`、`@scope/api`），由业务应用消费。
- 保持包边界清晰：不要在应用里直接 import 另一个应用的源码。
- 版本策略：业务应用可以锁 workspace:\*，发布库包再走 semver。

## 常见坑

- 依赖被 hoist 后在小程序构建时找不到：需要明确 npm 构建策略与复制规则（参考 `/guide/npm`）。
- 同名依赖多版本：尽量统一版本，减少运行时体积与兼容风险。

## 相关链接

- pnpm workspace：`pnpm-workspace.yaml`
- weapp-vite npm 策略：`/guide/npm`
