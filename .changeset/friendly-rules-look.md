---
'@wevu/web-apis': patch
---

修复小程序 Web Runtime 的网络兼容层不支持把宿主扩展参数稳定传到底层请求与 Socket 能力的问题。现在除了 `fetch(url, { miniProgram: { ... } })` / `fetch(url, { miniprogram: { ... } })` 和 `axios` 的 `fetchOptions.miniProgram` 之外，还新增了运行时级默认配置能力，可统一作用于 `fetch`、`XMLHttpRequest`、`WebSocket` 以及依赖这些全局对象的 `graphql-request`、`axios(xhr)`、`socket.io-client` 等库。显式请求参数会覆盖默认配置，同时仍保持 `url`、`method`、`header`、`data`、`responseType` 等标准字段由兼容层接管，不允许被宿主扩展项破坏。
