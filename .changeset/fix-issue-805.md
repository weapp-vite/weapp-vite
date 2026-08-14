---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 模板中 optional chaining 嵌套在空值合并表达式时未被降级的问题，确保生成的 WXML 不再包含小程序不支持的 `?.`。
