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

### `networkDefaults`

- **类型**：`MiniProgramNetworkDefaults`

传给 Web Runtime 网络兼容层的宿主默认参数，会作用到 `fetch`、`XMLHttpRequest`、`WebSocket` 对应的小程序底层能力。

显式调用时传入的 `miniProgram` 或 `miniprogram` 参数优先级更高。

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
