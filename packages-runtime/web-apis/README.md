# @wevu/web-apis 使用指南

## 1. 简介

`@wevu/web-apis` 为小程序运行时提供一组 Web API 兼容层，重点解决第三方库在小程序环境中缺失 `fetch`、`Request`、`Response`、`AbortController`、`XMLHttpRequest`、`URL`、`WebSocket`、Web Streams、`TextEncoder`、`TextDecoder`、`TextDecoderStream`、`EventSource`、`atob`、`btoa`、`queueMicrotask`、`performance.now`、`crypto.getRandomValues`、`Event`、`CustomEvent` 等全局对象的问题。

它主要服务于：

- `weapp-vite` 的 Web Runtime 全局注入能力
- `wevu` 运行时对 Web 风格请求库的兼容
- `axios`、`graphql-request` 等依赖 Web API 的第三方库

## 2. 特性

- 按需安装 `fetch`、`Headers`、`Request`、`Response`
- 提供 `AbortController` / `AbortSignal` 兼容层
- 提供 `XMLHttpRequest`、`URL`、`URLSearchParams`、`Blob`、`FormData`、`WebSocket` 兼容层
- 提供 Fetch 响应流、UTF-8 增量解码与标准 GET EventSource；网络增量交付要求宿主提供分块监听和早期真实状态码
- 提供 `atob`、`btoa`、`queueMicrotask`、`performance.now`、`crypto.getRandomValues`、`Event`、`CustomEvent` 兼容层
- 自动把能力安装到可用的小程序宿主全局对象
- 默认基于 `@wevu/api` 的请求能力完成底层转发

## 3. 安装

```bash
pnpm add @wevu/web-apis
```

## 4. 快速开始

### 4.1 安装完整 Web Runtime

```ts
import { installWebRuntimeGlobals } from '@wevu/web-apis'

installWebRuntimeGlobals()

const response = await fetch('https://request-globals.invalid/data')
console.log(await response.json())
```

### 4.2 仅安装 Abort 相关能力

```ts
import { installAbortGlobals } from '@wevu/web-apis'

installAbortGlobals()

const controller = new AbortController()
controller.abort()
```

### 4.3 按目标精简注入

```ts
import { installWebRuntimeGlobals } from '@wevu/web-apis'

installWebRuntimeGlobals({
  targets: ['fetch', 'Headers', 'Request', 'Response'],
})
```

### 4.4 安装轻量通用 Web Runtime 能力

```ts
import { installWebRuntimeGlobals } from '@wevu/web-apis'

installWebRuntimeGlobals({
  targets: ['atob', 'btoa', 'queueMicrotask', 'performance', 'crypto', 'Event', 'CustomEvent'],
})

const encoded = btoa('AB')
const decoded = atob(encoded)
const now = performance.now()
const bytes = crypto.getRandomValues(new Uint8Array(4))
const event = new CustomEvent('payload', { detail: { ok: true } })
```

### 4.5 安装并使用 WebSocket

```ts
import { installWebRuntimeGlobals } from '@wevu/web-apis'

installWebRuntimeGlobals({
  targets: ['WebSocket'],
})

const socket = new WebSocket('wss://example.com/socket', ['chat'])

socket.onopen = () => {
  socket.send(JSON.stringify({ type: 'ping' }))
}

socket.onmessage = (event) => {
  console.log(event.data)
}

socket.onclose = (event) => {
  console.log(event.code, event.reason)
}
```

## 5. 主要导出

| 导出                                                       | 说明                                            |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `installWebRuntimeGlobals`                                 | 按需安装 Web Runtime 全局对象                   |
| `installRequestGlobals`                                    | 旧别名，兼容历史代码                            |
| `installAbortGlobals`                                      | 仅安装 `AbortController` / `AbortSignal`        |
| `fetch`                                                    | 基于小程序请求能力适配的 `fetch` 实现           |
| `HeadersPolyfill` / `RequestPolyfill` / `ResponsePolyfill` | HTTP 相关兼容类                                 |
| `TextEncoderPolyfill` / `TextDecoderPolyfill`              | 文本编解码兼容类                                |
| `ReadableStreamPolyfill` / `WritableStreamPolyfill` / `TransformStreamPolyfill` | Web Streams 兼容构造器 |
| `TextDecoderStreamPolyfill`                               | UTF-8 流式解码器                                |
| `EventSourcePolyfill`                                     | GET SSE 客户端，支持事件监听与自动重连          |
| `URLPolyfill` / `URLSearchParamsPolyfill`                  | URL 相关兼容类                                  |
| `WebSocketPolyfill`                                        | 基于小程序 `SocketTask` 的 `WebSocket` 兼容实现 |
| `XMLHttpRequestPolyfill`                                   | XHR 兼容实现                                    |

## 6. 适用场景

- 在小程序环境中运行 `axios` 的 `fetch` 适配器
- 在小程序环境中运行 `graphql-request`
- 在小程序环境中直接复用浏览器风格的 `WebSocket` 客户端代码
- 在具备所需宿主能力的微信环境中复用 Fetch SSE 消费链路或标准 `EventSource`
- 在小程序环境中运行依赖 `atob` / `btoa` / `queueMicrotask` / `performance.now` / `crypto.getRandomValues` 的工具库
- 给依赖 `URL` / `FormData` / `Blob` 的库补齐基础全局对象

## 7. WebSocket 兼容说明

- 当前 `WebSocket` 兼容层底层桥接的是小程序 `SocketTask`
- 支持 `new WebSocket(url, protocols?)`、`send`、`close`、`readyState`、`binaryType`
- 支持 `onopen` / `onmessage` / `onerror` / `onclose` 以及 `addEventListener`
- 当前不会模拟浏览器里完整的 `bufferedAmount`、协商后的 `protocol`、`extensions`
- 如果运行时没有可用的 `connectSocket` 能力，构造时会直接抛错

## 8. 本地开发

```bash
pnpm --filter @wevu/web-apis build
pnpm --filter @wevu/web-apis test
pnpm --filter @wevu/web-apis typecheck
```

## 9. 相关链接

- `@wevu/api`：[../weapi/README.md](../weapi/README.md)
- `wevu`：[../wevu/README.md](../wevu/README.md)

## 10. 兼容说明

- 新项目建议使用 `installWebRuntimeGlobals()`
- `installRequestGlobals()` 仍保留为兼容别名，后续会逐步淡出文档主叙事

## 11. Body 与 Blob 契约

`RequestPolyfill` 和 `ResponsePolyfill` 提供可读 `body`，以及 `bytes()`、`arrayBuffer()`、`text()`、`json()`、`blob()`。非 null body 只能消费一次；调用消费方法或开始读取、取消 body 流时，`bodyUsed` 会变成 `true`。仅获取 reader 会锁定流，但不改变 `bodyUsed`。body 已消费或锁定时，重复读取和 `clone()` 都会以 `TypeError` 失败。需要多种读取方式时，请在消费前 clone：

```ts
import { ResponsePolyfill } from '@wevu/web-apis'

const response = new ResponsePolyfill('{"ok":true}', {
  headers: { 'content-type': 'application/json' },
})
const copy = response.clone()
const payload = await response.json()
const bytes = await copy.bytes()
```

null body 读取为空且保持未消费；空字符串和零长度二进制属于非 null body。JSON 解析失败或底层读取失败后，非 null body 仍保持已消费。`fetch(request)` 消费被继承的请求 body；`new RequestPolyfill(request)` 转移该 body，消费前 `request.clone()` 则保留两份独立的读取状态。

| 能力              | 支持范围                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Body 读取与 clone | 缓冲与流式 body 共享单次消费状态，通过 `tee()` 提供 clone 分支，保留错误与取消传播；ponyfill 的 `blob()` 不要求先安装全局 Blob |
| Blob / File       | UTF-8 字节长度、BufferSource 构造快照、独立 `bytes()`、负索引及越界 `slice()`、MIME 规范化                 |
| Headers.forEach   | 回调参数 `(value, key, headers)` 和可选 `thisArg`                                                          |
| BlobLike 扩展输入 | 保留异步 `arrayBuffer()` 兼容；无有效 `size` 的自定义对象不保证同步 size/切片语义，也不保证其自身不可变    |
| Streams           | 支持标准响应流、`getReader()`、`pipeThrough()` 与 `clone()/tee()`；Fetch 网络增量需开启 `enableChunked` 且宿主提供早期真实状态码；未提供流式上传和 `Blob.stream()` |
| formData()        | 未支持响应解析；FormData 请求上传继续支持 multipart 编码                                                   |

这些是本包 ponyfill 的能力边界。安装器保留可用的宿主实现，宿主对象的方法完整性应按目标基础库确认。

## SSE 与响应流

微信端可以保持 Web 消费方式。项目启用 Web Runtime 并设置
`weapp.appPrelude.webRuntime.networkDefaults.request.enableChunked: true` 后，
`fetch()` 在收到真实 HTTP 状态码和响应头时返回，后续字节通过 `Response.body` 交付。
`wevu/fetch` 复用同一实现。普通缓冲请求也提供可读 body，但不表示网络增量交付。

`@wevu/web-apis/streams` 导出作为一组选择的 `ReadableStream`、`WritableStream`、`TransformStream`，保留可用的原生实现，否则使用 `web-streams-polyfill@4.3.0` ponyfill。该入口也导出三个 `*Polyfill` 构造器和 `TextDecoderStreamPolyfill`。
`@wevu/web-apis/eventsource` 导出 `EventSourcePolyfill`、其别名 `EventSource` 与 `MessageEventPolyfill`，也可以由构建器注入全局 `EventSource`。
EventSource 自动启用分块请求，支持 GET、命名事件、`Last-Event-ID`、`retry` 与自动重连。
POST、自定义鉴权头使用 Fetch；Fetch 不自动重试请求。

缺少 chunk API 或早期 `statusCode` 时，流式 Fetch 以 `NotSupportedError` 失败，
EventSource 发出 error 并关闭，不推断 HTTP 200。开发者工具和真机能力需要分别验证。
`withCredentials: true` 不受支持；小程序域名白名单、TLS、超时和后台运行限制仍由宿主管理。
宿主没有已验证的暂停接收接口，JS 队列不代表网络级反压；慢消费和 clone 分支可能增加内存占用。

`AbortSignal` 在 Response 返回后仍能终止读取；`reader.cancel()` 取消请求。
页面卸载时需清理 EventSource 或中止 Fetch。对 clone 的单个分支取消不会取消另一分支。
