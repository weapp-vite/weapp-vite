---
title: SFC 总览：映射到小程序
---

# SFC 总览：映射到小程序

## 本章你会学到什么

- 一个 `.vue` 会被拆成哪些小程序文件（WXML/WXSS/JS/JSON）
- 在小程序里写“Vue 风格”时，哪些是相同的，哪些是不同的

## wuve（本文用法）到底是什么

在本教程里，**wuve** 指 weapp-vite 内置的 Vue SFC 编译链路：

- 你写：`<template>` / `<script>` / `<style>`（推荐 `<script setup lang="ts">`）
- 构建产物：小程序可识别的 WXML/WXSS/JS/JSON

它不是独立运行时；运行时由 `wevu` 提供（响应式、生命周期、setData diff）。

## 你要记住的 3 条规则

1. 模板最终落到 WXML：优先使用 `<view>`、`<text>`、`@tap` 等小程序语义。
2. 组件优先在脚本中 `import .vue`：这样类型提示与 IDE 集成更好。
3. 运行时 API 从 `wevu` 导入：响应式与 hooks 以 wevu 为准。

## 下一章

- Template 语法与差异：`/handbook/sfc/template`
