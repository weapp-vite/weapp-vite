---
'weapp-vite': patch
'@wevu/web-apis': patch
'create-weapp-vite': patch
---

将按需注入能力的主命名从偏窄的 request 语义收敛为更准确的 Web Runtime 语义。现在推荐使用 `weapp.appPrelude.webRuntime`、`weapp.injectWebRuntimeGlobals` 与 `installWebRuntimeGlobals()`，并保留 `requestRuntime`、`injectRequestGlobals`、`installRequestGlobals()` 作为兼容别名与过渡提示；同时同步更新类型导出、示例项目与文档，避免新增 `TextEncoder`、`TextDecoder`、`WebSocket`、`URL` 等能力后继续沿用过时命名。
