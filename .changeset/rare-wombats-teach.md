---
'@wevu/web-apis': minor
---

为 `@wevu/web-apis` 新增基于小程序 `SocketTask` 的 `WebSocket` 兼容层，并将其接入 `installRequestGlobals` 默认注入目标。现在可以在小程序运行时直接使用 `new WebSocket()`、`send()`、`close()`、`onopen`、`onmessage` 等浏览器风格接口，同时保留对 `@wevu/api` 底层连接能力的复用。
