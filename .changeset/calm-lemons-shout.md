---
'@weapp-vite/vscode': patch
---

修复 VS Code 扩展对 `weapp-vite.config.*` 的识别与激活链路：现在工作区仅存在 `weapp-vite.config.ts`、`weapp-vite.config.mts`、`weapp-vite.config.cts`、`weapp-vite.config.js`、`weapp-vite.config.mjs` 或 `weapp-vite.config.cjs` 时，也会触发扩展激活，并让配置文件补全、悬浮、项目探测与关键文件跳转保持一致；同时补齐 `vite.config.cts` / `vite.config.cjs` 的 manifest 激活覆盖，减少配置文件命名或后缀不同导致的能力缺失。
