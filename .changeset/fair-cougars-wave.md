---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite.config.ts` 与 `vite.config.ts` 的合并行为：现在无论只存在 `weapp-vite.config.ts`，还是两份配置同时存在，`weapp-vite.config.ts` 中的顶层 Vite 配置与 `weapp` 配置都会生效，且优先级高于 `vite.config.ts`。这保证了 `plugins`、`css`、`resolve`、`define` 等配置能稳定参与构建。
