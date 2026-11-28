---
title: App Prelude
description: 介绍 weapp-vite 的 app.prelude 前置脚本，以及它在小程序入口执行前统一初始化代码的使用方式。
keywords:
  - app.prelude
  - prelude
  - 前置脚本
  - appPrelude
---

# App Prelude

`app.prelude` 用来在小程序 `app`、页面、组件等入口执行前插入一段前置脚本。它关注的是“代码执行时机”：先把基础运行环境或自定义全局状态准备好，再让业务入口继续执行。

[[toc]]

## 什么时候需要它

常见场景包括：

- 你要在业务入口前统一初始化一段自包含脚本。
- 你需要在主包、普通分包和独立分包中保持一致的前置注入行为。
- 你希望把运行时补丁、监控启动标记、基础全局变量放到业务模块初始化之前。

如果你的问题是让 `axios`、`graphql-request`、`socket.io-client` 等依赖在小程序里识别 `fetch`、`XMLHttpRequest`、`WebSocket`，请看 [Web Runtime 全局对象注入](/guide/web-runtime-globals)。

## 它做什么

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

## 推荐做法

新项目优先使用：

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'require',
    },
  },
})
```

需要 Web 风格全局对象时，可以在同一个 `appPrelude` 配置下启用 `webRuntime`。默认的 `inline`、`entry`、`require` 继续使用原有 Web Runtime 注入路径和默认安装时机。

新增的 `native` 是显式选择的第四种模式：自由标识符和 `globalThis.<target>` 等全局对象点号访问通过 Rolldown 的 `transform.inject` 精确绑定，字符串计算属性、全局解构与别名等不可点号注入的访问使用按目标裁剪的幂等桥接；自定义 `app.prelude` 作为普通静态模块执行。该模式没有 `prelude` 或策略选项，也不生成 installer、eager 状态或 axios 专用补丁。Prelude 自身引用 Web 目标时遵循相同模块依赖规则，不会形成反向循环。完整边界见 [App Prelude 配置](/config/app-prelude#mode) 和 [Web Runtime 全局对象注入配置](/config/web-runtime-globals)。

## 验证方式

构建后可以检查产物中是否出现这些内容：

- `require` 模式的 `app.prelude.js`
- `require` 模式入口 JS 顶部的 `require("./app.prelude.js")` 或等价相对路径
- `native` 模式的普通 Prelude 模块、精确绑定与按需目标级全局桥接依赖

```bash
pnpm build
```

然后查看 `dist` 下的 `app.js`、页面 JS 和分包目录。

## 继续阅读

- [App Prelude 配置](/config/app-prelude)
- [Web Runtime 全局对象注入](/guide/web-runtime-globals)
- [调试与排错](/handbook/debugging)
