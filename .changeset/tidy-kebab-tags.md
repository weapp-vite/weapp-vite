---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

默认将 Vue 模板中的 PascalCase 组件标签及其自动生成的 `usingComponents` 配置转换为 kebab-case，避免微信开发者工具因 WXML 标签含大写字母而无法识别。
