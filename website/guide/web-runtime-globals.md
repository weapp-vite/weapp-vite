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

`weapp.appPrelude.webRuntime` 为 Web Runtime 兼容对象提供注入能力。原有 `inline`、`entry`、`require` 模式会把兼容对象安装到小程序全局环境；显式设置 `weapp.appPrelude.mode: 'native'` 后，自由标识符和 `globalThis.<target>` 等全局对象点号访问通过 Rolldown 的原生 `transform.inject` 精确导入，只有不可点号注入的显式全局语义才写入对应的 `globalThis` 目标。

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
- `ReadableStream`、`WritableStream`、`TransformStream`
- `TextDecoderStream`
- `EventSource`

启用后，旧模式会安装 Web Runtime 提供的兼容对象。`native` 模式为 `fetch`、`XMLHttpRequest`、`URL` 等自由标识符，以及 `globalThis.fetch()` 等全局对象点号访问生成模块级绑定；只有 `globalThis['fetch']` 等不可点号注入的访问才生成目标级桥接。这样第三方库在模块初始化阶段读取能力时也能获得正确实现，同时避免无关全局污染。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
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

## `native` 模式如何绑定

`native` 是 `appPrelude.mode` 的第四种模式，必须显式选择，行为固定为精确优先，不提供策略选项：只写 `mode: 'native'` 就启用全部允许目标，不需要再配置 `webRuntime`，也不读取项目依赖；未被代码引用的实现由 tree-shaking 去除。

| 使用方式 | 处理 | 全局写入 |
| --- | --- | --- |
| 自由标识符 | Rolldown `transform.inject` 精确绑定 | 无 |
| 全局对象点号访问 | Rolldown `transform.inject` 按固定 dotted 键精确绑定 | 无 |
| 不可点号注入的显式全局访问 | 静态依赖目标级桥接 | 仅涉及目标 |
| `globalTargets` | 在相关入口静态依赖目标级桥接 | 仅声明目标 |

binding 模块类似 transform-runtime，只精确导入并重导出目标。全局桥接从 binding 或用户 override 导入目标，使用受保护的 `globalThis[key]` 读写：完整宿主实现优先保留，缺失、占位或上一轮 native 安装的值可替换，已有但不完整的实现按目标修补。写入成功后回读确认并标记 native 所有权，因此 HMR 可以替换自身旧实例，同时不覆盖真实宿主或用户实现。模块缓存保证同一目标只安装一次；主包、普通分包、独立分包、共享 chunk、Vue 和动态导入都遵循普通模块依赖，不依赖固定 chunk 名或优先级。

自由标识符与点号全局访问的局部绑定和词法遮蔽交给 Rolldown。桥接分析只处理无法按固定 dotted 键注入的形式，包括字符串中括号、可选计算访问、全局对象解构和别名，并排除局部遮蔽。第三方库内部的动态 key、间接别名或动态求值无法可靠静态推断；需要这些访问时配置 `globalTargets`，不需要配置库名：

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

`native` 不读取 `dependencies`，不生成 `installWebRuntimeXXX`、eager installer context、finalizer 或 axios 环境模块，也不执行 `__wvAXFE__` bundle patch。axios 与其他库没有特殊分支：自由标识符和点号全局访问直接注入，计算属性等不可点号注入的读取由目标桥接提供。桥接不会用 polyfill 替换完整宿主实现；可修补的缺口（如 `Headers.getSetCookie`、`Response.json/error`、`URL.parse/canParse`）会就地修复并保留构造器身份。

用户在 `build.rolldownOptions.transform.inject` 中的映射始终优先。自由标识符覆盖会同步到对应的 `globalThis.<target>`、`window.<target>` 等点号注入键；显式 dotted 覆盖最高，并供仍走桥接的访问使用。基础 binding 不反向导入用户 override，避免覆盖模块读取其他目标时形成循环。

自定义 `app.prelude` 是普通静态模块，自身引用使用相同规则，binding 不会反向依赖 Prelude。旧 `inline`、`entry`、`require` 模式及默认 `require` 保持不变，旧模式仍可使用 `weapp.injectWebRuntimeGlobals.prelude`。

## 复用 Web SSE 写法

`EventSource` 可以直接用于 GET 事件流，并自动处理重连及 `Last-Event-ID`：

```ts
import { onUnload } from 'wevu'

const source = new EventSource('https://example.com/events')
source.onmessage = event => console.log(event.data)

onUnload(() => {
  source.close()
})
```

需要 POST 或自定义鉴权头时，在 `webRuntime.networkDefaults.request` 中设置 `enableChunked: true`，随后使用 Fetch 响应流：

```sh
pnpm add eventsource-parser
```

```ts
import { EventSourceParserStream } from 'eventsource-parser/stream'
import { onUnload } from 'wevu'

const controller = new AbortController()
onUnload(() => {
  controller.abort()
})

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

`TextDecoderStream` 会保留跨数据块的 UTF-8 状态；SSE 解析器再处理跨块消息和多行 `data`。不要把一次网络 chunk 当成一个事件，也不要对每个 chunk 单独做无状态中文解码。

Wevu 页面应在同步 setup 阶段注册 `onUnload`，由它调用 `source.close()` 或 `controller.abort()`，不能在请求 `await` 之后才注册生命周期。

流式接口只在宿主能够提前提供真实状态码和分块数据时可用；缺失能力会明确报错。首版不模拟浏览器 Cookie/CORS，`EventSource` 不支持 `withCredentials: true`。安装配置与宿主边界见 [Web Runtime 全局对象注入配置](/config/web-runtime-globals#fetch-响应流与-sse)。

## 和浏览器 Web runtime 的关系

`weapp.web` 和 `weapp.appPrelude.webRuntime` 名字相近，但作用不同。

| 配置                          | 作用位置             | 主要用途                            |
| ----------------------------- | -------------------- | ----------------------------------- |
| `weapp.web`                   | 浏览器侧附加运行链路 | 页面预览、兼容验证、截图联调        |
| `weapp.appPrelude.webRuntime` | 小程序构建产物 | 旧模式安装全局对象；`native` 精确绑定并按全局语义桥接 |

如果你要在浏览器中预览小程序页面，配置 `weapp.web`。
如果你要让小程序产物兼容 Web 风格请求库，配置 `weapp.appPrelude.webRuntime`。需要精确注入时显式选择 `mode: 'native'`。

## 推荐做法

需要 Rolldown 原生模块绑定时，显式选择：

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        enabled: true,
      },
    },
  },
})
```

建议把 Web Runtime 全局对象注入统一放在 `weapp.appPrelude.webRuntime` 下，这样配置和执行时机都更清晰。

## 验证方式

构建后重点检查使用 Web 全局对象的模块是否通过 `import` 或 `require` 依赖 Web Runtime 绑定。`native` 模式可额外检查：

- 仅使用自由标识符或全局对象点号访问时不写全局，也没有 installer、eager 状态或 axios patch。
- 不可点号注入的显式全局访问和 `globalTargets` 只依赖涉及的目标桥接；完整宿主能力保持不变，已知不完整能力按目标修补。
- 桥接使用受保护的 `globalThis[key]` 读写，不依赖 `Reflect.get/set`；native 安装值带所有权标记，HMR 可替换自身旧实例。
- 自定义 Prelude 作为普通模块执行，引用目标时建立正常依赖，binding 不反向依赖 Prelude。
- 主包、普通分包、独立分包和动态导入都使用可解析的构建图依赖。
- 所有 emitted JS 均无 `installWebRuntime*`、`axiosEnv`、`eagerBindings` 或 `__wvAXFE__`。

绑定和桥接可能被 tree-shake、合并或改名，因此不要固定要求某个 vendor 文件名，应按实际模块依赖和运行时语义判断。

`app.prelude.js` 只在自定义前置脚本使用旧版 `require` 模式时生成，用于承载 Web Runtime installer 与自定义前置脚本；`inline` 和 `entry` 模式把代码内联到目标 chunk，`native` 模式使用独立 Prelude vendor chunk。chunk 文件名可能随共享策略和压缩配置变化，不宜按固定文件名判断注入是否生效。

```bash
pnpm build
```

然后查看 `dist` 下的 `app.js`、页面 JS 和分包目录。

## 继续阅读

- [Web Runtime 全局对象注入配置](/config/web-runtime-globals)
- [App Prelude](/guide/app-prelude)
- [Web 运行时配置](/config/web)
