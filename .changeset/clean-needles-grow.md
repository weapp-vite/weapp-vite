---
'@weapp-vite/vscode': minor
'create-weapp-vite': minor
---

VS Code 扩展现在会在页面 `.vue` 已能识别为页面文件但尚未声明到 `app.json` 时，直接在当前页面给出诊断提示，并只在这类页面上显示 `Add Current Page To app.json` 的补齐操作，减少普通组件中的无关提示。
