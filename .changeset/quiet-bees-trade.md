---
"weapp-vite": patch
---

优化 `autoImportComponents` 生成的 `components.d.ts`：支持在 VSCode 中对第三方组件（如 `@vant/weapp`、`tdesign-miniprogram`）`Cmd/Ctrl+Click` 直接跳转到源码，同时保留 props 智能提示。
