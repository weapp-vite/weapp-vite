---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite` 配置加载与测试夹具清理行为。现在 `loadViteConfigFile` 与 CLI 默认使用 Vite 的 `bundle` 配置加载器，以提升 `vite.config.*` / `weapp-vite.config.*` 在不同 ESM/CJS 场景下的兼容性；同时调整仓库级 Vitest 全局清理逻辑，只清理真实临时输出，避免在执行 `pnpm test` 时误删已跟踪的 fixture `dist-*` 快照产物，并为夹具目录补充局部 `.gitignore` 来消除未跟踪测试生成物噪音。
