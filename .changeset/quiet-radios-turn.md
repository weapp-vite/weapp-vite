---
"@weapp-core/logger": minor
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

feat: 统一 CLI 终端染色入口到 logger colors。

- `@weapp-core/logger` 新增 `colors` 导出（基于 `picocolors`），作为统一终端染色能力。
- 对齐 `packages/*/src/logger.ts` 适配层，统一通过本地 `logger` 入口透传 `colors`。
- 后续 CLI 代码可统一使用 `from '../logger'`（或 `@weapp-core/logger`）进行染色，避免分散依赖与手写 ANSI。
- 本次发布包含 `weapp-vite`，同步 bump `create-weapp-vite` 以保持脚手架依赖一致性。
