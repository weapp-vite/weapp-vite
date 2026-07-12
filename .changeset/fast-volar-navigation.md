---
"@weapp-vite/volar": patch
---

减少普通 Vue SFC 在 Volar 冷启动和项目失效重建时的重复解析，并复用 `defineOptions` 增强所需的 TypeScript AST，提升跳转与模板语言服务的首次响应性能。
