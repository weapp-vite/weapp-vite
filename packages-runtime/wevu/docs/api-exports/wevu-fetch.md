# wevu/fetch 类型导出清单

- 子路径: `./fetch`
- 类型入口: `./dist/fetch.d.mts`
- 运行时入口: `./dist/fetch.mjs`
- 类型导出总数: **5**
- 仅类型导出数（推断）: **4**
- 运行时同名导出数: **1**

## 类型导出（完整）

1. `MiniProgramRequestMethod`
2. `WevuFetchInit`
3. `WevuFetchInput`
4. `WxRequestMethod`
5. `fetch`

## 仅类型导出（推断）

1. `MiniProgramRequestMethod`
2. `WevuFetchInit`
3. `WevuFetchInput`
4. `WxRequestMethod`

## 与运行时同名导出

1. `fetch`

## 说明

`wevu/fetch` 只负责 Fetch 风格请求入口；完整 Web API 兼容层请使用 `wevu/web-apis`。

## SSE 响应流

`wevu/fetch` 复用 `@wevu/web-apis` 的响应流：项目通过
`weapp.appPrelude.webRuntime.networkDefaults.request.enableChunked: true` 开启网络增量交付。
可以使用 `response.body.getReader()` 或 `pipeThrough(new TextDecoderStream())`，
并接入 `eventsource-parser/stream`。底层必须提供早期真实 HTTP 状态码和 chunk 监听；
缺少能力时以 `NotSupportedError` 失败。普通缓冲请求继续可用。
GET 订阅也可以使用注入的 `EventSource`，页面卸载时调用 `close()`；
POST、自定义 headers 走 Fetch，并通过 `AbortController` 管理取消。
Wevu 页面需在同步 setup 阶段注册 `onUnload`，不能等请求返回后再注册清理。
