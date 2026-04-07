---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复原生 WXML 模板通过 `<import>` 与 `<include>` 引入共享 template 时的自动组件导入行为。现在自动导入会基于模板依赖闭包聚合组件标签，并在共享 template 变更时按引用链增量失效缓存，避免遗漏 `usingComponents` 注册且保持较高性能。
