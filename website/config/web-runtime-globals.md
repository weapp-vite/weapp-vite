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

这一页介绍 `weapp.appPrelude.webRuntime` 的配置。旧模式会在小程序运行时安装 Web Runtime 全局对象；显式选择 `weapp.appPrelude.mode: 'native'` 时，模块绑定使用 Rolldown 原生注入，不写入全局 Web API。其他模式保留旧版注入路径。

如果你想先理解这个功能解决什么问题，请看 [Web Runtime 全局对象注入](/guide/web-runtime-globals)。

[[toc]]

## `weapp.appPrelude.webRuntime.globalTargets` {#weapp-appprelude-webruntime-globaltargets}

- **类型**：`WeappInjectWebRuntimeGlobalsTarget[]`
- **仅适用于**：`weapp.appPrelude.mode: 'native'`

声明需要安装到 `globalThis` 的目标，用于第三方库内部无法静态推断的动态索引或间接全局访问；除基础目标外，也可以写依赖展开目标（`URL`、`URLSearchParams`、`Blob`、`File`、`FormData`）。构建器为每个目标生成最小普通桥接模块：完整宿主实现优先保留，缺失、占位或上一轮 native 安装的值可替换；已有但不完整的宿主实现按目标修补能力并保留构造器身份。未声明的目标不会因为该选项被安装；`prelude: true` 已安装全部目标时再声明，每个构建作用域会得到一次告警。

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        targets: ['fetch', 'Request', 'Response'],
        globalTargets: ['fetch', 'Request', 'Response'],
      },
    },
  },
})
```

`native` 不使用 `dependencies`，也没有策略选项。自由标识符与 `globalThis.fetch`、`window?.URL` 等全局对象点号访问由 Rolldown `transform.inject` 精确绑定，不写入全局；`globalThis['fetch']` 等字符串计算属性、全局解构与无法按固定点号键注入的别名只安装涉及的目标。动态 key 无法静态推断时使用 `globalTargets` 精确补充，不需要为 axios 等具体库增加包名特例。

旧模式的 `weapp.injectWebRuntimeGlobals.prelude` 仍控制是否在业务入口前安装全局对象；嵌套 `weapp.appPrelude.webRuntime` 始终提前安装。

自定义 `app.prelude` 是普通静态模块，其中自由标识符和显式全局访问使用与业务模块相同的规则。完整边界见 [Web Runtime 全局对象注入](/guide/web-runtime-globals#native-模式如何绑定)。

## `weapp.appPrelude.webRuntime`（`mode: 'native'`）的固定行为 {#weapp-appprelude-webruntime-native}

native 的行为固定为精确最优解，**无策略开关**：

- **自由标识符与点号全局访问**：由 Rolldown `transform.inject` 精确绑定到实现模块，按需导入、可 tree-shake，不写全局；局部同名遮蔽由 Rolldown 保留。
- **不可点号注入的显式全局访问**：`globalThis['fetch']` 等字符串计算属性、全局解构与别名按目标生成幂等桥接；`globalTargets` 声明的目标同样桥接。桥接使用 `globalThis[key]` 受保护读写，不依赖 `Reflect.get/set`。
- **产物拆分**：绑定、桥接与实现的分包交给打包器自然分组，不强制额外 vendor；自定义 App Prelude 独立成 `weapp-vendors/web-runtime-app-prelude.js`。独立分包保留自己构建根内的实现，不跨包引用主包 vendor。
- **不全量安装**：未使用的目标不会被安装，避免破坏精确性。无法静态推断的隐藏访问用 `globalTargets` 精确补充。

用户只需通过 `targets` 选择作用域、`globalTargets` 精确补充隐藏访问：

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        targets: ['fetch', 'URL'],
        globalTargets: ['Request'],
      },
    },
  },
})
```

`native` 的求值顺序始终由普通模块依赖决定，不需要 Prelude 启动协调，安装时机不可配置。桥接保留完整宿主实现，替换缺失、占位或自身上一轮安装的值；对已有但不完整的宿主实现，按目标修复已知能力缺口。真正不可枚举的动态访问（如 `globalThis[任意key]`）不在 native 覆盖范围，需要这类整体安装语义时使用 `require` 模式。

## `weapp.appPrelude.webRuntime.prelude`（旧模式） {#weapp-appprelude-webruntime-prelude-legacy}

- **类型**：`boolean`

`inline` / `entry` / `require` 模式下表示安装时机：是否在业务入口之前安装 Web Runtime 全局对象。嵌套 `weapp.appPrelude.webRuntime` 的默认值由 `mode` 决定，保持既有行为；需要旧模式延迟安装时使用顶层 `weapp.injectWebRuntimeGlobals.prelude: false`。

## `weapp.appPrelude.webRuntime` {#weapp-appprelude-webruntime}

- **类型**：

```ts
// 未指定 mode，或 mode 为 inline / entry / require
boolean | WeappWebRuntimeConfig

// mode 为 native
boolean | WeappNativeWebRuntimeConfig
```

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        enabled: true,
        targets: ['fetch', 'Headers', 'Request', 'Response', 'XMLHttpRequest'],
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

当 `webRuntime: true` 或仅指定 `mode: 'native'` 时，启用全部允许目标；未使用目标由 tree-shake 消除。`false` 或 `{ enabled: false }` 关闭 Web Runtime。`native` 不读取项目依赖，也不需要配置 `dependencies`。

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
| `ReadableStream` / `WritableStream` / `TransformStream` | Web Streams 构造器，作为一致的一组绑定 |
| `TextDecoderStream` | 将响应字节流增量解码为 UTF-8 文本 |
| `EventSource` | SSE 事件监听与自动重连 |

当请求类目标启用时，构建器还会为 `URL`、`URLSearchParams`、`Blob`、`FormData` 等依赖对象补充模块绑定。

`targets` 是精确绑定的**资格集合**（opt-out 作用域），默认全部允许目标：它决定哪些自由标识符会被绑定到实现，实际进包量再由 tree-shake 按真实引用裁剪，因此它不是直接的体积旋钮。把某目标移出 `targets`，其裸标识符不再被绑定，回落到运行时全局。

### `globalTargets`

- **类型**：`WeappInjectWebRuntimeDeclaredGlobalTarget[]`（基础目标与依赖展开目标 `URL`/`URLSearchParams`/`Blob`/`File`/`FormData`）
- **仅适用于**：`mode: 'native'`

为无法静态推断的全局访问安装指定目标。每个目标独立桥接、按需加载，完整宿主能力优先，已有但不完整的实现按目标修补。自由标识符注入不会受该选项影响；该选项也独立于 `targets` 绑定资格，收窄 `targets` 不会裁剪声明的目标。安装范围是**声明目标 + 其必要依赖闭包**（如声明 `fetch` 会一并装上它依赖的 `URL`/`TextEncoder` 等），不会全量安装与声明无关的未用实现。声明的目标由根入口（含各分包根）静态依赖桥接，在启动期完成安装。

### `dependencies`

- **类型**：`(string | RegExp)[]`
- **不适用于**：`mode: 'native'`

旧模式自动匹配项目依赖的规则。匹配到相关依赖后，`weapp-vite` 会按规则启用对应目标。显式设置 `enabled: true` 或提供 `networkDefaults` 时走显式启用路径，不再按包名匹配。`native` 不使用此字段。

默认会关注：

- `axios`
- `graphql-request`
- `socket.io-client`
- `engine.io-client`
- `ky`
- `stream-markdown-parser`
- `@tanstack/query-core`
- `@tanstack/vue-query`
- `eventsource-parser`（包含 `eventsource-parser/stream` 导入）

自动模式下，`app.prelude` 与共享运行时块只提前安装命中依赖对应的目标组：`axios` / `graphql-request` / `ky` / `stream-markdown-parser` 对应请求运行时组，`@tanstack/query-core` / `@tanstack/vue-query` 对应取消组，只有 `socket.io-client` / `engine.io-client` 才会提前安装 `WebSocket`。业务 chunk 与用户 `app.prelude` 中实际引用的目标也会加入提前安装集合，其余目标仍按各产物 chunk 的实际使用情况按需注入。

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
      mode: 'native',
      webRuntime: {
        enabled: true,
        networkDefaults: { request: { enableChunked: true } },
      },
    },
  },
})
```

`EventSource` 自行启用分块传输，不要求全局设置 `enableChunked`。选择 `TextDecoderStream` 会同时引入 `TextDecoder` 和三个 Streams 构造器；选择 `EventSource` 还会补充 Fetch、取消和事件相关依赖。`native` 模式通过 Rolldown 原生注入建立模块绑定，确保依赖在模块初始化阶段就能使用构造器，同时尊重代码中的局部同名变量；旧模式保留原有绑定改写方式。

流式响应要求宿主在响应结束前同时提供真实 HTTP 状态码、响应头和数据块。缺少其中任一能力时会明确失败，不假定状态码为 200，也不会以完整响应缓冲模拟增量交付。微信开发者工具与真机需要分别验证；其他平台不因共享 API 而自动获得相同能力。

`EventSource` 保持标准 GET 用法；POST、自定义鉴权头通过 Fetch 实现。首版不模拟浏览器 Cookie/CORS 环境，`withCredentials: true` 会报告不支持。小程序宿主未提供可验证的暂停接收接口，因此 JS 流消费控制不等同于网络级反压。

## 产物说明

启用 `appPrelude.webRuntime` 后，构建产物中可能出现：

| 产物 | 说明 |
| --- | --- |
| Web Runtime 绑定 chunk | `native` 模式下精确导出供模块注入使用的绑定，自身不写全局（全局写入由目标桥接模块负责）；分包交给打包器自然分组，可能被合并 |
| 目标级全局桥接 | `native` 为不可点号注入的显式全局访问或 `globalTargets` 涉及的目标安装全局能力；只覆盖声明/引用的目标，不全量安装 |
| App Prelude 模块 | `native` 下作为普通静态模块执行，不承担 Web Runtime 启动协调；该模式注册一条分组规则把它单独拆成 `weapp-vendors/web-runtime-app-prelude.js`，旧模式仍输出 `app.prelude.js` 并且不注册任何 Web Runtime 分组规则 |
| 入口、业务模块或动态导入模块的静态依赖 | 由实际引用和全局语义决定；除只在 `native` 生效的 app-prelude vendor 分组规则外，不额外固定 chunk 名称与优先级 |

用户在 `build.rolldownOptions.transform.inject` 中提供的同名映射优先于 `native` 框架默认值。自由标识符覆盖会同步到对应的 `globalThis.<target>`、`window.<target>` 等点号注入键；用户显式提供的 dotted 覆盖优先，仍走桥接的访问也遵循该顺序。`native` 不生成 axios 环境 chunk 或 `__wvAXFE__` bundle patch。

## 常见配置

### 只启用默认注入

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
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
      mode: 'native',
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
      },
    },
  },
})
```

## 继续阅读

- [Web Runtime 全局对象注入](/guide/web-runtime-globals)
- [App Prelude 配置](/config/app-prelude)
- [Web 运行时配置](/config/web)
