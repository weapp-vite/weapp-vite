---
"@weapp-vite/vscode": patch
---

优化 VS Code 中 WXML 与 Vue template 的跳转体验：静态 class 使用位置会以虚线下划线提示可跳转到样式定义，并修复 `item.label` 等 `wx:for` 隐式成员表达式和 `section-title` 等 kebab 名称的整体 token 跳转。
