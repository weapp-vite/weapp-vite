---
'weapp-vite': patch
---

修复 `pnpm deps:up` 无法进入显式工作区同步模式的问题，确保依赖升级后能正确恢复 `catalog:` 声明并通过 Rolldown 单版本校验。
