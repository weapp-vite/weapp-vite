---
'@weapp-vite/vscode': patch
---

增强 VS Code 扩展中组件定义侧的 references 能力。现在从 weapp-vite 组件脚本里的 props、models、emits 或原生组件 `triggerEvent` 定义位置发起时，可以反查识别到的 `.vue` 模板和独立 `.wxml` 文件中的组件属性与事件用法。
