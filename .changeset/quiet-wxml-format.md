---
"@weapp-vite/vscode": patch
---

修复 VS Code 扩展格式化 WXML 时会打开临时 HTML 文档、并可能把格式化结果拼出 `undefined` 的问题；现在使用内置 WXML formatter 直接在当前文档内生成格式化结果。
