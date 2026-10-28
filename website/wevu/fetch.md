---
title: wevu/fetch
description: 基于 @wevu/api 的 request 能力提供 Fetch 风格接口，说明 wevu/fetch 的定位、限制与推荐用法。
keywords:
  - wevu/fetch
  - fetch
  - wevu
  - request
---

# `wevu/fetch`

`wevu/fetch` 提供了一个接近标准 Fetch 的接口，但底层仍然走小程序请求能力。当前实现基于 `@wevu/api` 的 `wpi.request`，适合想用 `fetch(url, init)` 心智写小程序请求的场景。

:::warning 安装方式
在 `weapp-vite` 项目里，`wevu` 通常建议安装在 `devDependencies` 中：

```sh
pnpm add -D wevu
```

这是 Weapp-vite + Wevu 的常见推荐组合；若你是在其他构建场景单独消费 `wevu/fetch`，应按自己的发布方式决定依赖落位。
:::

## 导出内容

- `fetch(input, init?)`

```ts
import { fetch } from 'wevu/fetch'

const response = await fetch('https://example.com/api/user?id=1')
const data = await response.json()
```

## 行为特点

- 返回值是 `Promise<Response>`
- HTTP `4xx/5xx` 不会自动抛错，和标准 Fetch 一致
- 网络层失败会抛出 `TypeError`
- 支持 `AbortSignal`
- `GET/HEAD` 请求不允许携带 `body`
- 默认使用 `arraybuffer` 响应，再按 `Response` 接口能力解码

## 常见示例

### JSON 请求

```ts
import { fetch } from 'wevu/fetch'

const response = await fetch('https://example.com/api/todos', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({ title: 'write docs' }),
})

const result = await response.json()
```

### 取消请求

```ts
import { fetch } from 'wevu/fetch'

const controller = new AbortController()

const request = fetch('https://example.com/api/slow', {
  signal: controller.signal,
})

controller.abort()

await request
```

## 与浏览器原生 Fetch 的差异

- 支持 `FormData` 请求体；兼容层负责生成 multipart 边界和二进制内容
- 兼容 `Response` 暂不支持 `formData()` 响应解析
- 请求最终还是映射到小程序的 `request` 语义，不是浏览器网络栈
- `Headers` / `Response` 在低能力环境下会回退到内部兼容实现

如果你需要的是“统一多端小程序 API 风格”，而不是 Fetch 语义，优先看 [wevu/api](/wevu/api-package)。

## 适合什么场景

- 团队已经习惯 `fetch` 接口
- 想减少 `wx.request` / `wpi.request` 的回调式心智
- 需要和 Web 侧共享一部分请求封装思路

## 相关页面

- [wevu/api](/wevu/api-package)
- [运行时与生命周期](/wevu/runtime)

## SSE 与响应流

项目级开启分块传输后，业务代码可以复用 Web 的 Fetch 流写法：

```ts
// vite.config.ts 中的 weapp 配置
const weapp = {
  appPrelude: {
    webRuntime: {
      networkDefaults: { request: { enableChunked: true } },
    },
  },
}
```

下面的 SSE 解析器需单独安装：

```sh
pnpm add eventsource-parser
```

```ts
import { EventSourceParserStream } from 'eventsource-parser/stream'
import { fetch } from 'wevu/fetch'

const controller = new AbortController()
const response = await fetch('https://example.com/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
  body: JSON.stringify({ message: '你好' }),
  signal: controller.signal,
})
if (!response.ok) {
  controller.abort()
  throw new Error(`HTTP ${response.status}`)
}

const reader = response.body!
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new EventSourceParserStream())
  .getReader()

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    console.log(value.data)
  }
}
finally {
  controller.abort()
  reader.releaseLock()
}
```

GET 订阅可使用注入的标准 `EventSource`：

```ts
const source = new EventSource('https://example.com/events')
source.onmessage = event => console.log(event.data)
source.addEventListener('update', event => console.log(event))
// 使用结束后：source.close()
```

EventSource 自动启用分块传输与断线重连，支持事件 ID 和服务端 retry；
POST、自定义 headers 使用 Fetch，Fetch 本身不会自动重试。
Wevu 页面应在同步 setup 阶段注册 `onUnload`，回调中执行 `controller.abort()` 或 `source.close()`。

微信先行：宿主必须支持 chunk 监听，并在响应结束前给出真实状态码。
缺少这些能力时会明确返回 `NotSupportedError`，不会假定成功或静默缓冲。
EventSource 在此情况下触发 error 并关闭。`withCredentials: true` 暂不支持；
其他平台、真机和开发者工具需分别验证。小程序后台运行、域名白名单和网络超时仍遵循宿主限制。
