---
title: app-bar
description: Skyline 全局工具栏的固定保留目录，与 appBar 配置一一对应。
keywords:
  - Skyline
  - appBar
  - 目录结构
  - app-bar
---

# `app-bar/`

这是 Skyline 全局工具栏的固定目录。

## 触发条件

当 `app.json` 中声明了 `appBar` 配置时，`weapp-vite` 会把 `app-bar/index` 当成固定入口。

## 位置要求

- 目录名必须是 `app-bar`
- 必须和 `app.json` 处于同一个 `srcRoot` 下

## 它和普通页面的区别

- 不参与自动路由扫描
- 不应放进 `pages/`
- 语义来自平台配置，而不是约定式页面目录
