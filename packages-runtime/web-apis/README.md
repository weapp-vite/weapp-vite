# @wevu/web-apis 使用指南

## 1. 简介

`@wevu/web-apis` 为小程序运行时提供一组 Web API 兼容层，重点解决第三方库在小程序环境中缺失 `fetch`、`Request`、`Response`、`AbortController`、`XMLHttpRequest`、`URL`、`WebSocket`、`TextEncoder`、`TextDecoder` 等全局对象的问题。

它主要服务于：

- `weapp-vite` 的 Web Runtime 全局注入能力
- `wevu` 运行时对 Web 风格请求库的兼容
- `axios`、`graphql-request` 等依赖 Web API 的第三方库

## 2. 特性

- 按需安装 `fetch`、`Headers`、`Request`、`Response`
- 提供 `AbortController` / `AbortSignal` 兼容层
- 提供 `XMLHttpRequest`、`URL`、`URLSearchParams`、`Blob`、`FormData`、`WebSocket` 兼容层
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

### 4.4 安装并使用 WebSocket

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
| `URLPolyfill` / `URLSearchParamsPolyfill`                  | URL 相关兼容类                                  |
| `WebSocketPolyfill`                                        | 基于小程序 `SocketTask` 的 `WebSocket` 兼容实现 |
| `XMLHttpRequestPolyfill`                                   | XHR 兼容实现                                    |

## 6. 适用场景

- 在小程序环境中运行 `axios` 的 `fetch` 适配器
- 在小程序环境中运行 `graphql-request`
- 在小程序环境中直接复用浏览器风格的 `WebSocket` 客户端代码
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
