---
'@weapp-vite/vscode': minor
'create-weapp-vite': minor
---

增强 VS Code 扩展的 WXML 与 weapp-vite 模板开发体验：新增 WXML 语言支持，并完善原生组件、本地组件与原生自定义组件的元数据提取、补全、Hover、条件属性展示、标签/属性/事件预览、定义跳转、引用查询、重命名、链接跳转、模板变量装饰与标签高亮能力；同时拆分 `.vue <template>` 与独立 `.wxml` 的增强开关，补充安装态 `.vsix` 真实宿主 e2e 校验并修复真实 VS Code 宿主中的激活兼容问题。相关模板初始化能力也随原生组件条件补全一起同步更新到 `create-weapp-vite`。
