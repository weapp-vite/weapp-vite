---
"weapp-vite": patch
---

新增 `?take` 指令：在分包中通过 `import 'xxx?take'` 使用模块时，会强制将该模块复制到对应分包的 `weapp-shared/common.js`，即便全局共享策略为 `hoist`；若仍存在普通导入，构建日志会提示该模块同时保留在主包与相关分包中，便于后续重构。
