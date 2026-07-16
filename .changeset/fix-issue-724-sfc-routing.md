---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复复杂插件调度下 Vue SFC 主请求与样式虚拟请求可能跳过编译分流的问题，避免原始 `<template>`、`<script>` 或 `<style>` 内容进入 Babel 与 Vite CSS 处理阶段。
