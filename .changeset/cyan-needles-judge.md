---
'@weapp-vite/vscode': patch
---

为 VS Code 扩展补上独立 `wxml` 文件的格式化能力：现在扩展会为 `wxml` 注册 document formatter，并委托 VS Code 内置 HTML formatter 输出格式化结果，同时补充 activation、smoke 与格式化委托测试，避免后续发布回归。
