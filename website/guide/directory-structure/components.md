---
title: components
description: 主包组件目录，默认参与自动导入组件扫描。
---

# `components/`

这是主包组件目录，也是自动导入组件的默认扫描入口之一。

## 默认扫描范围

当 `weapp.autoImportComponents` 默认开启时，会扫描：

- `<srcRoot>/components/**/*.wxml`
- 每个已声明分包 root 下的 `components/**/*.wxml`

## 它解决什么问题

你通常不必再手写 `usingComponents`，框架会在构建时完成自动注册与补全。

## 适合放什么

- 复用组件
- 本地设计系统组件
- 主包与多个页面共享的 UI 模块

相关文档：[自动导入组件](/guide/auto-import)
