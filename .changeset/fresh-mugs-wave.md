---
'@weapp-core/init': patch
'@weapp-vite/web': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `packages/web` 与仓库级构建中的声明打包 warning，减少 `pnpm build` 时的噪音日志，并为包含 Vue SFC 的 e2e 工程补齐 `wevu` 依赖声明，避免构建阶段出现误报警告。
