---
"@weapp-vite/web": minor
---

- WXML 支持 `slot` 原生标签，并为 `wx-import` / `wx-include` 提供别名处理。
- `<template is>` 支持 `data` 简写对象语法，自动补齐为对象字面量。
- WXML 编译递归收集 `import` / `include` 依赖，缺失或循环时给出警告。
- 缺失模板时给出告警并安全返回空输出，避免运行时报错。
- WXS 增强：解析扩展名顺序、`?wxs` 标记、`require` 规则与缺失模块告警。
- `defineComponent` 支持 `observerInit`，初始化阶段只触发一次 observer。
- Component behaviors 支持递归合并 data / properties / methods / lifetimes，并保持顺序。
