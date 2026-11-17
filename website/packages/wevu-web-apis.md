---
title: '@wevu/web-apis'
description: 为小程序补齐 fetch、URL、WebSocket、Streams 等 Web API 的兼容层。
keywords: [wevu, web-apis, fetch, websocket, eventsource]
---

# @wevu/web-apis

`@wevu/web-apis` 提供按需安装的 Web API polyfill，适合在小程序中运行 axios、graphql-request、SSE、WebSocket 和依赖 `URL`/`FormData` 的库。

## 安装与最小用法

```bash
pnpm add @wevu/web-apis
```

```ts
import { installWebRuntimeGlobals } from '@wevu/web-apis'
import { fetch } from '@wevu/web-apis/fetch'

installWebRuntimeGlobals({ targets: ['fetch', 'Headers', 'Request', 'Response'] })
const response = await fetch('https://api.example.com/data')
```

也可以只安装 Abort 能力：

```ts
import { installAbortGlobals } from '@wevu/web-apis'

const { AbortController } = installAbortGlobals()
```

## AI 选择提示

需要自由变量 `fetch`、`EventSource` 等时，还要打开 `weapp.appPrelude.webRuntime`；单独调用安装器不能替代编译期局部绑定。只安装目标能力，避免无条件注入完整 Web API。
