---
"@weapp-vite/vscode": patch
---

为 VS Code 扩展新增 `app.json` 页面路径补全：在顶层 `pages` 和 `subPackages` / `subpackages` 的页面数组中，编辑器会根据项目内已有页面文件补全 route，并在分包场景下自动使用相对 `root` 的路径写法。
