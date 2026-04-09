---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为 Vue 模板编译新增 HTML 标签到 WXML 内置标签的映射能力：`.vue` 模板中的常见 HTML 标签现在会默认转换为对应的小程序标签，并支持通过 `vue.template.htmlTagToWxml` 自定义或关闭映射表。与此同时，`wevu` 的内置标签类型也补齐了这些 HTML 风格别名，避免在编辑器中为 `div`、`span`、`img`、`a` 等标签报出 `IntrinsicElements` 缺失错误，减少从 Web/Vue 项目迁移到 weapp-vite / wevu 时的模板改造成本。
