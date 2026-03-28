---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复托管 `.weapp-vite/tsconfig.app.json` 在未配置 `weapp.web` 时仍默认注入 `vite/client` 的问题。现在仅在显式启用 `weapp.web` 时才会加入该类型声明，避免 `create-weapp-vite` 生成的默认模板在 `pnpm install` 后因为未直接依赖 `vite` 而出现 TypeScript 类型报错。
