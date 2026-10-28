---
title: Web Runtime 全局对象注入配置
description: weapp.appPrelude.webRuntime 的配置说明，覆盖 Web Runtime 全局对象注入、目标对象、依赖匹配与网络默认参数。
keywords:
  - 配置
  - webRuntime
  - fetch
  - XMLHttpRequest
  - WebSocket
---

# Web Runtime 全局对象注入配置 {#web-runtime-globals-config}

这一页介绍 `weapp.appPrelude.webRuntime` 的配置。它在 `appPrelude` 时机安装 Web Runtime 全局对象，并保留 chunk 级局部绑定兜底。

如果你想先理解这个功能解决什么问题，请看 [Web Runtime 全局对象注入](/guide/web-runtime-globals)。

[[toc]]

## `weapp.appPrelude.webRuntime` {#weapp-appprelude-webruntime}

- **类型**：

```ts
boolean | {
  enabled?: boolean
  targets?: WeappInjectWebRuntimeGlobalsTarget[]
  dependencies?: (string | RegExp)[]
  networkDefaults?: MiniProgramNetworkDefaults
}
```

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'require',
      webRuntime: {
        enabled: true,
        targets: ['fetch', 'Headers', 'Request', 'Response', 'XMLHttpRequest'],
        dependencies: [/^axios$/, /^graphql-request$/],
        networkDefaults: {
          request: {
            timeout: 10000,
          },
          socket: {
            timeout: 10000,
          },
        },
      },
    },
  },
})
```

### `enabled`

- **类型**：`boolean`

显式启用或关闭 Web Runtime 全局对象注入。

当 `webRuntime: true` 时，等价于使用默认目标集合启用注入。

### `targets`

- **类型**：`WeappInjectWebRuntimeGlobalsTarget[]`

可选值包括：

| 目标 | 说明 |
| --- | --- |
| `fetch` / `Headers` / `Request` / `Response` | Fetch 请求相关对象 |
| `XMLHttpRequest` | 兼容 axios 等 XHR 路径 |
| `WebSocket` | 兼容 WebSocket 风格客户端 |
| `AbortController` / `AbortSignal` | 请求取消相关对象 |
| `TextEncoder` / `TextDecoder` | 请求体、响应体和二进制处理 |
| `atob` / `btoa` | Base64 编解码 |
| `queueMicrotask` | 微任务调度 |
| `performance` / `crypto` | 常见 Web API |
| `Event` / `CustomEvent` | 事件构造器 |
| `ReadableStream` / `WritableStream` / `TransformStream` | Web Streams 构造器，作为一致的一组安装 |
| `TextDecoderStream` | 将响应字节流增量解码为 UTF-8 文本 |
| `EventSource` | SSE 事件监听与自动重连 |

当请求类目标启用时，构建器还会为 `URL`、`URLSearchParams`、`Blob`、`FormData` 等依赖对象补充局部绑定。

### `dependencies`

- **类型**：`(string | RegExp)[]`

自动模式下用于匹配项目依赖。匹配到相关依赖后，`weapp-vite` 会按规则启用对应目标。

默认会关注：

- `axios`
- `graphql-request`
- `socket.io-client`
- `engine.io-client`
- `@tanstack/query-core`
- `@tanstack/vue-query`
- `eventsource-parser`（包含 `eventsource-parser/stream` 导入）

### `networkDefaults`

- **类型**：`MiniProgramNetworkDefaults`

传给 Web Runtime 网络兼容层的宿主默认参数，会作用到 `fetch`、`XMLHttpRequest`、`WebSocket` 对应的小程序底层能力。

显式调用时传入的 `miniProgram` 或 `miniprogram` 参数优先级更高。

### Fetch 响应流与 SSE

微信端可以在项目级启用 Fetch 分块传输，业务代码继续使用标准 `fetch`、`response.body` 和 `AbortController`：

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      webRuntime: {
        enabled: true,
        networkDefaults: { request: { enableChunked: true } },
      },
    },
  },
})
```

`EventSource` 自行启用分块传输，不要求全局设置 `enableChunked`。选择 `TextDecoderStream` 会同时安装 `TextDecoder` 和三个 Streams 构造器；选择 `EventSource` 还会补充 Fetch、取消和事件相关依赖。构建器保留 chunk 内的局部绑定，确保依赖在模块初始化阶段就能使用构造器。

流式响应要求宿主在响应结束前同时提供真实 HTTP 状态码、响应头和数据块。缺少其中任一能力时会明确失败，不假定状态码为 200，也不会以完整响应缓冲模拟增量交付。微信开发者工具与真机需要分别验证；其他平台不因共享 API 而自动获得相同能力。

`EventSource` 保持标准 GET 用法；POST、自定义鉴权头通过 Fetch 实现。首版不模拟浏览器 Cookie/CORS 环境，`withCredentials: true` 会报告不支持。小程序宿主未提供可验证的暂停接收接口，因此 JS 流消费控制不等同于网络级反压。

## 产物说明

启用 `appPrelude.webRuntime` 后，构建产物中可能出现：

| 产物 | 说明 |
| --- | --- |
| `app.prelude.js` | `require` 模式下按作用域生成的前置脚本 |
| `weapp-vendors/request-globals-web-apis-shared.js` | Web Runtime 全局对象 installer 共享模块 |
| 入口 JS 顶部的 `require(...)` | 用于提前执行对应作用域的 `app.prelude.js` |

## 常见配置

### 只启用默认注入

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      webRuntime: true,
    },
  },
})
```

### 仅兼容 axios / graphql-request 请求链路

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      webRuntime: {
        enabled: true,
        targets: [
          'fetch',
          'Headers',
          'Request',
          'Response',
          'AbortController',
          'AbortSignal',
          'XMLHttpRequest',
        ],
        dependencies: [/^axios$/, /^graphql-request$/],
      },
    },
  },
})
```

## 继续阅读

- [Web Runtime 全局对象注入](/guide/web-runtime-globals)
- [App Prelude 配置](/config/app-prelude)
- [Web 运行时配置](/config/web)
