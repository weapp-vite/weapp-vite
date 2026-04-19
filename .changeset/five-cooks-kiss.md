---
'wevu': patch
'create-weapp-vite': patch
---

让 `wevu` 新增正式的 `wevu/web-apis` 子路径导出，用来暴露 `@wevu/web-apis` 的公开能力，方便直接从 `wevu` 侧获取 `Headers` / `Request` / `Response` 兼容层、`WebSocket` 兼容层以及 `installWebRuntimeGlobals`、`setMiniProgramNetworkDefaults` 等 Web Runtime 安装函数。同时 `wevu/fetch` 会收敛回只负责本地 `fetch` 语义，不再顺带混入整套 `web-apis` 导出，整体出口结构会更清晰。现在 `wevu/fetch` 也会接入 `miniProgram` / `miniprogram` 请求参数和运行时默认网络配置，确保通过 `wevu/fetch` 发出的请求与 Web Runtime 注入链路在宿主扩展参数上保持一致。
