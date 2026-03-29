---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 在复杂测试并发场景下读取 `vite.config.*` / `weapp-vite.config.*` 时，对 `weapp-vite/config` 与 `weapp-vite/auto-import-components/resolvers` 的解析不稳定问题。现在会在加载配置时生成进程级临时 shim，避免依赖易被并发测试清理的 `dist` 产物，并统一覆盖显式配置路径与自动发现配置路径，确保 `pnpm test` 与真实 CLI / 运行时配置加载都能稳定工作。
