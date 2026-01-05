---
"weapp-vite": patch
---

修复 Vue SFC 模板中 kebab-case 组件标签（如 `t-cell-group`/`t-cell`）未能通过 `autoImportComponents` 自动写入 `usingComponents` 的问题；同时修复模板表达式生成时中文被转为 `\\uXXXX` 导致 WXML 直接显示转义序列的问题。
