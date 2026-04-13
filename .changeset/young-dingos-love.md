---
"@weapp-vite/vscode": patch
---

为 VS Code 扩展新增 `Add Current Page To app.json` 动作：可直接把当前页面文件对应的 route 写入 `app.json`，并自动根据已有分包 `root` 判断写入顶层 `pages` 还是对应分包的 `pages` 数组。
