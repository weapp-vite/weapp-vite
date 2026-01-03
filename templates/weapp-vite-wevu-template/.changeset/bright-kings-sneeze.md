---
"weapp-vite": patch
---

增强 `autoImportComponents`：

- 支持在 `.vue` 模板中自动识别并注册第三方小程序组件（如 `@vant/weapp`、`tdesign-miniprogram`）。
- 新增 `weapp.autoImportComponents.vueComponents`，可生成 `components.d.ts`，为 Vue 模板提供组件与 props 智能提示。
- props 类型会优先从第三方组件的 `.d.ts`（如 TDesign 的 `miniprogram_dist/**.d.ts`）或实现代码中提取。

