# @wevu/web-apis 使用指南

## 1. 简介

`@wevu/web-apis` 为小程序运行时提供一组 Web API 兼容层，重点解决第三方请求库在小程序环境中缺失 `fetch`、`Request`、`Response`、`AbortController`、`XMLHttpRequest`、`URL` 等全局对象的问题。

它主要服务于：

- `weapp-vite` 的请求全局注入能力
- `wevu` 运行时对 Web 风格请求库的兼容
- `axios`、`graphql-request` 等依赖 Web API 的第三方库

## 2. 特性

- 按需安装 `fetch`、`Headers`、`Request`、`Response`
- 提供 `AbortController` / `AbortSignal` 兼容层
- 提供 `XMLHttpRequest`、`URL`、`URLSearchParams`、`Blob`、`FormData` 兼容层
- 自动把能力安装到可用的小程序宿主全局对象
- 默认基于 `@wevu/api` 的请求能力完成底层转发

## 3. 安装

```bash
pnpm add @wevu/web-apis
```

## 4. 快速开始

### 4.1 安装完整请求全局

```ts
import { installRequestGlobals } from '@wevu/web-apis'

installRequestGlobals()

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
import { installRequestGlobals } from '@wevu/web-apis'

installRequestGlobals({
  targets: ['fetch', 'Headers', 'Request', 'Response'],
})
```

## 5. 主要导出

| 导出                                                       | 说明                                     |
| ---------------------------------------------------------- | ---------------------------------------- |
| `installRequestGlobals`                                    | 按需安装请求相关全局对象                 |
| `installAbortGlobals`                                      | 仅安装 `AbortController` / `AbortSignal` |
| `fetch`                                                    | 基于小程序请求能力适配的 `fetch` 实现    |
| `HeadersPolyfill` / `RequestPolyfill` / `ResponsePolyfill` | HTTP 相关兼容类                          |
| `URLPolyfill` / `URLSearchParamsPolyfill`                  | URL 相关兼容类                           |
| `XMLHttpRequestPolyfill`                                   | XHR 兼容实现                             |

## 6. 适用场景

- 在小程序环境中运行 `axios` 的 `fetch` 适配器
- 在小程序环境中运行 `graphql-request`
- 给依赖 `URL` / `FormData` / `Blob` 的库补齐基础全局对象

## 7. 本地开发

```bash
pnpm --filter @wevu/web-apis build
pnpm --filter @wevu/web-apis test
pnpm --filter @wevu/web-apis typecheck
```

## 8. 相关链接

- `@wevu/api`：[../weapi/README.md](../weapi/README.md)
- `wevu`：[../wevu/README.md](../wevu/README.md)
