---
'@wevu/web-apis': minor
'weapp-vite': minor
'create-weapp-vite': patch
---

新增 `@wevu/web-apis` 包，用于承载小程序运行时中的 Web API 垫片与全局注入能力。`weapp-vite` 现在直接复用该包提供 `weapp-vite/web-apis` 入口，后续可以在独立包中持续扩展 `fetch`、`URL`、`Blob`、`FormData` 以及更多 Web 对象的维护与注入逻辑。
