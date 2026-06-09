---
"create-weapp-vite": patch
---

修复 TailwindCSS 模板中的 Iconify 图标只生成 `--svg` 变量、缺少 `.iconify` 基础 mask 渲染类而不可见的问题。模板内的 `i-mdi-*` 图标现在会同时带上 Iconify 基础类，构建产物会生成小程序可渲染的 mask 图标规则。
