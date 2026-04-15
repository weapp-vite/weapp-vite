---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复仅使用 `weapp-vite.config.ts` 时顶层 `plugins`、`css`、`resolve` 等 Vite 配置被遗漏的问题，确保 `UnifiedViteWeappTailwindcssPlugin` 等用户插件能够正确注册并参与构建。
