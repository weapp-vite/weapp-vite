---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `wevu`、`wevu/*` 与 `vue-demi` 在工作区构建中的默认别名解析，避免因包入口解析失败导致 `pnpm build` 在 `weapp-vite` 相关 e2e 应用构建阶段报错。
