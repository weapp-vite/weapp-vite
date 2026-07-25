---
'@weapp-vite/ast': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

修复跨分包 `require(path, callback, errorCallback)` 被当成同步 CommonJS 依赖并提升到主包的问题，统一通过 `require.async()` Promise 通道输出异步模块，同时补充 callback、Promise 与真实小程序运行时回归覆盖。
