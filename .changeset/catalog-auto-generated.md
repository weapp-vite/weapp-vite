---
'@wevu/compiler': patch
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-vite': patch
---

统一 Rolldown 依赖的 workspace catalog 引用，避免 pnpm 更新后将 catalog 协议写回为固定版本；同时同步 magic-string、sass-embedded 及相关构建依赖版本，并更新脚手架模板 catalog。
