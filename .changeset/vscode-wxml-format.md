---
"@weapp-vite/vscode": patch
---

修复 VS Code 扩展格式化 WXML 时打开临时 HTML 文档并可能在结果中拼出 undefined 的问题，改为使用内置 WXML formatter 直接生成当前文档的格式化结果。
