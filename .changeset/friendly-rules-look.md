---
'@wevu/web-apis': patch
---

修复小程序 Web Runtime 的 `fetch` 请求桥接不支持透传宿主请求扩展参数的问题。现在可以通过 `fetch(url, { miniProgram: { ... } })` 或 `fetch(url, { miniprogram: { ... } })` 传入白名单内的小程序请求选项；在 `axios` 的 fetch adapter 场景下，也可以通过 `fetchOptions.miniProgram` 把这些配置继续转发到底层 `wpi.request`。同时保持 `url`、`method`、`header`、`data`、`responseType` 等由兼容层接管的标准字段不被宿主扩展覆盖。
