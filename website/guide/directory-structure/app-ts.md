---
title: app.(js|ts)
description: 应用脚本入口，支持 JavaScript 与 TypeScript，承载 App 生命周期和全局初始化逻辑。
keywords:
  - App 生命周期
  - TypeScript
  - 目录结构
  - app.ts
---

# `app.(js|ts)`

`app.(js|ts)` 是应用脚本入口。

## 适合放什么

- App 生命周期
- 全局启动逻辑
- 埋点初始化
- 和 `wevu`、router、全局状态相关的初始化

## 支持哪些后缀

- `app.js`
- `app.ts`

如果你项目使用的是原生小程序增强模式，这通常就是应用逻辑的主入口。

## 它和页面目录的关系

它不参与自动路由扫描，但它通常是全局行为的起点。
目录结构上，它与 `app.json(.js|.ts)?`、`app.(css|scss|wxss|...)` 一起构成应用入口三件套。
