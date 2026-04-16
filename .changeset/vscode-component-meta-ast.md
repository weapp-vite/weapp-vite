---
"@weapp-vite/vscode": patch
---

优化 VS Code 扩展对本地 Vue 组件 `props`、`emits` 与 `defineModel` 的模板元信息提取逻辑，改为轻量 AST 解析并避免引入 `vue/compiler-sfc` 运行时依赖，从而在保持包体积稳定的同时提升补全结果的准确性。
