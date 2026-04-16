---
'@weapp-vite/vscode': patch
---

增强 VS Code 扩展中组件维度的 WXML references / rename 能力。现在从独立 `.wxml` 或识别到的 weapp-vite `.vue` 模板里的本地组件标签、组件属性、组件事件位置发起时，可以联动当前文件模板引用、`usingComponents` 声明以及组件定义位置进行引用查询与重命名。
