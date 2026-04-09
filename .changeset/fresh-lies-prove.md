---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复纯原生小程序入口对 request globals 的局部绑定注入，确保 `app` 入口与原生页面一样能稳定拿到 `fetch`、`URL`、`XMLHttpRequest`、`WebSocket` 等能力，并补充纯原生 `axios`、`graphql-request`、`socket.io-client` 真实请求 e2e 示例。
