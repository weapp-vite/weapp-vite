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

- `FormData` 请求体当前不支持
- fallback `Response` 下的 `formData()` 也不支持
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
