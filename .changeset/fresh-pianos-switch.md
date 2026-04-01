---
'@weapp-vite/web-apis': minor
'weapp-vite': minor
'create-weapp-vite': patch
---

新增 `@weapp-vite/web-apis` 包，用于承载小程序运行时中的 Web API 垫片与全局注入能力，并将 `weapp-vite` 原有的 `requestGlobals` 实现提炼为对该包的兼容导出。这样后续可以在独立包中持续扩展 `fetch`、`URL`、`Blob`、`FormData` 以及更多 Web 对象的维护与注入逻辑，同时保持现有 `weapp-vite/requestGlobals` 用法可继续工作。
