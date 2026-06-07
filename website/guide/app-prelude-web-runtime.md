---
title: App Prelude 与 Web Runtime 全局注入
description: 介绍 weapp-vite 的 app.prelude 前置脚本、Web Runtime 全局对象注入，以及它们在第三方请求库兼容中的使用方式。
keywords:
  - app.prelude
  - web runtime
  - fetch
  - XMLHttpRequest
  - WebSocket
  - axios
  - graphql-request
---

# App Prelude 与 Web Runtime 全局注入

`weapp-vite` 提供两类容易混淆、但经常一起使用的运行时增强：

- `app.prelude`：在小程序 `app`、页面、组件等入口执行前插入一段前置脚本。
- `appPrelude.webRuntime`：把 `fetch`、`Headers`、`XMLHttpRequest`、`WebSocket` 等 Web 风格全局对象安装到小程序运行环境。

它们解决的是“代码执行时机”和“第三方依赖运行环境假设”这两个问题。

[[toc]]

## 什么时候需要它

:::: details 展开本节说明 {open}

常见场景包括：

- 你要在业务入口前统一初始化一段自包含脚本。
- 你在小程序里使用 `axios`、`graphql-request`、`socket.io-client` 等更偏 Web 环境的依赖。
- 第三方依赖在模块初始化阶段直接读取 `fetch`、`XMLHttpRequest`、`URL`、`AbortController` 这类自由变量。
- 你需要在主包、普通分包和独立分包中保持一致的前置注入行为。

如果只是想做浏览器预览，请看 [Web 运行时配置](/config/web)。这一页讨论的是“小程序产物中如何提前安装 Web Runtime 全局对象”。

::::

## app.prelude 做什么

:::: details 展开本节说明 {open}

在源码根目录放置 `app.prelude.ts` 或 `app.prelude.js` 后，`weapp-vite` 会把它包装成一段只执行一次的前置脚本，并按配置注入到产物中。

```ts
// src/app.prelude.ts
globalThis.__appBootMeta__ = {
  env: 'dev',
  startedAt: Date.now(),
}
```

默认配置下，`weapp-vite` 会采用 `require` 模式：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    appPrelude: {
      enabled: true,
      mode: 'require',
    },
  },
})
```

`require` 模式会按主包、普通分包和独立分包作用域生成 `app.prelude.js`，再在对应 JS chunk 顶部插入静态 `require(...)`。这样既能保持较早执行时机，又能减少重复内联代码。

> [!NOTE]
> `app.prelude` 当前必须是自包含脚本，不能包含 `import` 或 `export`。

::::

## Web Runtime 全局对象注入做什么

:::: details 展开本节说明 {open}

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

`weapp.appPrelude.webRuntime` 会在前置时机安装 Web Runtime 提供的兼容对象，并在 chunk 作用域内保留局部绑定兜底。这个兜底很重要，因为部分第三方库会在模块初始化阶段直接执行 `typeof XMLHttpRequest`、`new URL()` 或缓存 `fetch` 引用。

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

::::

## 和浏览器 Web runtime 的关系

:::: details 展开本节说明 {open}

`weapp.web` 和 `weapp.appPrelude.webRuntime` 名字相近，但作用不同。

| 配置                          | 作用位置             | 主要用途                            |
| ----------------------------- | -------------------- | ----------------------------------- |
| `weapp.web`                   | 浏览器侧附加运行链路 | 页面预览、兼容验证、截图联调        |
| `weapp.appPrelude.webRuntime` | 小程序构建产物       | 在小程序运行时安装 Web 风格全局对象 |

如果你要在浏览器中预览小程序页面，配置 `weapp.web`。
如果你要让小程序产物兼容 Web 风格请求库，配置 `weapp.appPrelude.webRuntime`。

::::

## 推荐做法

:::: details 展开本节说明 {open}

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

::::

## 验证方式

:::: details 展开本节说明 {open}

构建后可以检查产物中是否出现这些内容：

- `app.prelude.js`
- `weapp-vendors/request-globals-web-apis-shared.js`
- 入口 JS 顶部的 `require("./app.prelude.js")` 或等价相对路径

```bash
pnpm build
```

然后查看 `dist` 下的 `app.js`、页面 JS 和分包目录。

::::

## 继续阅读

- [App Prelude 配置](/config/app-prelude)
- [Web 运行时配置](/config/web)
- [调试与排错](/handbook/debugging)
