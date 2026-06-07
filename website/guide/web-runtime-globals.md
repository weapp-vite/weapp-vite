---
title: Web Runtime 全局对象注入
description: 介绍 weapp-vite 如何在小程序产物中注入 fetch、XMLHttpRequest、WebSocket 等 Web 风格全局对象。
keywords:
  - web runtime
  - fetch
  - XMLHttpRequest
  - WebSocket
  - axios
  - graphql-request
---

# Web Runtime 全局对象注入

`weapp.appPrelude.webRuntime` 会在前置时机把 Web Runtime 提供的兼容对象安装到小程序运行环境，并在 chunk 作用域内保留局部绑定兜底。

它关注的是“第三方依赖运行环境假设”：有些依赖会在模块初始化阶段直接读取 `fetch`、`XMLHttpRequest`、`URL`、`AbortController` 这类自由变量，小程序宿主默认不一定提供这些对象。

[[toc]]

## 什么时候需要它

常见场景包括：

- 你在小程序里使用 `axios`、`graphql-request`、`socket.io-client` 等更偏 Web 环境的依赖。
- 第三方依赖在模块初始化阶段直接读取 `fetch`、`XMLHttpRequest`、`URL`、`AbortController` 这类自由变量。
- 你需要在主包、普通分包和独立分包中保持一致的 Web Runtime 注入行为。

如果你只是想在业务入口前运行一段自包含初始化脚本，请看 [App Prelude](/guide/app-prelude)。

## 注入哪些对象

小程序宿主不等同于浏览器。很多 Web 依赖会默认全局存在这些对象：

- `fetch`
- `Headers`
- `Request`
- `Response`
- `XMLHttpRequest`
- `WebSocket`
- `AbortController`
- `URL`
- `URLSearchParams`

启用后，构建器会在前置时机安装 Web Runtime 提供的兼容对象，并在 chunk 作用域内保留局部绑定兜底。这个兜底很重要，因为部分第三方库会在模块初始化阶段直接执行 `typeof XMLHttpRequest`、`new URL()` 或缓存 `fetch` 引用。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'require',
      webRuntime: true,
    },
  },
})
```

如果你只想覆盖请求相关对象，可以显式配置 `targets`：

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'require',
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

## 和浏览器 Web runtime 的关系

`weapp.web` 和 `weapp.appPrelude.webRuntime` 名字相近，但作用不同。

| 配置                          | 作用位置             | 主要用途                            |
| ----------------------------- | -------------------- | ----------------------------------- |
| `weapp.web`                   | 浏览器侧附加运行链路 | 页面预览、兼容验证、截图联调        |
| `weapp.appPrelude.webRuntime` | 小程序构建产物       | 在小程序运行时安装 Web 风格全局对象 |

如果你要在浏览器中预览小程序页面，配置 `weapp.web`。
如果你要让小程序产物兼容 Web 风格请求库，配置 `weapp.appPrelude.webRuntime`。

## 推荐做法

新项目优先使用：

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'require',
      webRuntime: {
        enabled: true,
      },
    },
  },
})
```

建议把 Web Runtime 全局对象注入统一放在 `weapp.appPrelude.webRuntime` 下，这样配置和执行时机都更清晰。

## 验证方式

构建后可以检查产物中是否出现这些内容：

- `app.prelude.js`
- `weapp-vendors/request-globals-web-apis-shared.js`
- 入口 JS 顶部的 `require("./app.prelude.js")` 或等价相对路径

```bash
pnpm build
```

然后查看 `dist` 下的 `app.js`、页面 JS 和分包目录。

## 继续阅读

- [Web Runtime 全局对象注入配置](/config/web-runtime-globals)
- [App Prelude](/guide/app-prelude)
- [Web 运行时配置](/config/web)
