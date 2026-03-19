---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `prepare` 引导阶段对 `process.exitCode` 的守卫失效问题，避免支持文件预生成流程在可忽略场景下遗留非零退出码；同时补齐根 Vitest 覆盖率临时目录初始化，并同步更新 `import-umd` 测试快照，使 `pnpm test` 恢复稳定通过。
