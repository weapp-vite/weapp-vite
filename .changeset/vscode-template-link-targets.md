---
'@weapp-vite/vscode': patch
---

增强 VS Code 扩展中 WXML 与识别到的 weapp-vite Vue 模板的链接跳转能力。现在 `navigator` 等模板中的 `url` 属性会优先解析为小程序页面路由并跳转到对应页面文件，同时保留 `src` 等资源路径的文件跳转能力，覆盖独立 `.wxml` 与识别到的 `.vue <template>` 场景。
