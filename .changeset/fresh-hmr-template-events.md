---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复模板产物最终输出阶段遗漏的 Vue 事件简写归一化，避免后处理插件或原生模板中残留 `@tap` 导致开发者工具 WXML 语法错误。
