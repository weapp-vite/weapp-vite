---
"@weapp-vite/vscode": patch
---

为 VS Code 扩展新增 `app.json` 页面声明诊断：当 `pages`、`subPackages` 或 `subpackages` 中声明的页面在项目内找不到对应 `.vue`、`.ts`、`.js` 或 `.wxml` 文件时，编辑器会直接给出提示，帮助更早发现页面路径拼写错误或遗漏文件的问题。
