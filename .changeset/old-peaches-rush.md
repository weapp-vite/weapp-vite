---
'@wevu/web-apis': patch
---

修复 `@wevu/web-apis` 中 `URLPolyfill` 与 `RequestPolyfill` / `fetch` 直接组合时的兼容问题，统一 `URL`、`TextEncoder`、`TextDecoder` 构造器解析，并收敛 `Request` / `Response` 的 body 内部状态暴露，同时补充 `TextEncoderPolyfill` 与 `TextDecoderPolyfill` 的根入口导出。
