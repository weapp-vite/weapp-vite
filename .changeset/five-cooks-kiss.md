---
'wevu': patch
'create-weapp-vite': patch
---

让 `wevu` 根入口与 `wevu/fetch` 子路径同时暴露 `@wevu/web-apis` 的公开导出，方便直接从 `wevu` 侧获取 `fetch`、`Headers` / `Request` / `Response` 兼容层、`WebSocket` 兼容层以及 `installWebRuntimeGlobals`、`setMiniProgramNetworkDefaults` 等 Web Runtime 能力。这样使用方不需要再额外切换到 `@wevu/web-apis` 才能拿到这些小程序 Web API 兼容对象与安装函数。
