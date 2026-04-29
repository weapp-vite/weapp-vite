---
"@weapp-vite/vscode": patch
---

修复 WXML 模板中 `item.label` 这类 `wx:for` 隐式成员表达式的跳转，并让 VS Code 对 `section-title` 等 kebab 名称按整体 token 处理。
