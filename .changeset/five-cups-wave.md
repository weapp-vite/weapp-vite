---
'weapp-vite': patch
'create-weapp-vite': patch
---

扩展 `weapp.autoImportComponents` 配置，支持直接写成 `true` 来启用增强默认值：自动使用默认组件扫描规则，并额外开启 `typedComponents`、`vueComponents`，在检测到 `wevu` 依赖时还会自动补上 `vueComponentsModule: 'wevu'`，从而简化 wevu 模板和常见项目配置。
