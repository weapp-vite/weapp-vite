---
'@weapp-core/init': patch
'@weapp-core/shared': patch
'@weapp-vite/web': patch
'create-weapp-vite': patch
'weapp-ide-cli': patch
'weapp-vite': patch
---

将多个源码包中直接使用的 `fs-extra` 调用统一迁移到 `@weapp-core/shared` 提供的原生 `node:fs` / `node:fs/promises` 兼容层，减少重复文件系统封装，并清理相关直接依赖与测试 mock。
