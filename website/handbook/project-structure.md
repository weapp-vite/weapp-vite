---
title: 目录结构与分层
description: 目录结构与分层，聚焦 handbook / project-structure 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - handbook
  - project
  - structure
  - 目录结构与分层
  - 聚焦
  - /
  - project-structure
  - 相关场景
---

# 目录结构与分层

## 本章你会学到什么

- 页面/组件/服务/Store 的推荐分层
- 小程序 `pages/components` 与工程化目录如何兼容

## 推荐结构（可按团队裁剪）

```txt
src/
  app/                # 全局能力：启动、全局注入、拦截器、日志等
  pages/              # 页面（每个页面一个目录）
  components/         # 复用组件（业务组件/通用组件）
  stores/             # wevu store（按 domain 拆）
  services/           # 请求封装、API SDK、上传下载
  utils/              # 通用工具
  assets/             # 静态资源（尽量贴近使用方放置）
```

## 页面与组件的“最小单位”

- 页面：`pages/foo/index.vue`（或 `index.ts + index.wxml + index.wxss`）
- 组件：`components/bar/index.vue`

## 约定（强烈建议）

- 组件名：`kebab-case`（便于映射到 `usingComponents`）
- 页面路径：保持稳定，避免频繁变更导致线上路径兼容问题
- Store：按业务域拆（`stores/user.ts`、`stores/cart.ts`），避免“巨型 store”

## 相关链接

- 目录结构：`/guide/directory-structure`
- 分包：`/guide/subpackage`
