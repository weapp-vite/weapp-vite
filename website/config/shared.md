---
title: 共享配置
description: weapp-vite 的共享增强配置，包含自动路由、调试钩子、日志、app.prelude 前置注入、forwardConsole、injectWeapi、injectRequestGlobals 与 MCP 等能力。
keywords:
  - 配置
  - config
  - shared
  - autoRoutes
  - appPrelude
  - mcp
  - forwardConsole
  - injectWeapi
---

# 共享配置 {#shared-config}

这一页覆盖那些“不只属于某一种文件类型”的通用增强能力：

- 自动路由
- 调试钩子
- 构建日志控制
- `app.prelude` 前置注入
- DevTools 控制台日志桥接
- 运行时全局注入
- 本地 MCP 服务

[[toc]]

## `weapp.autoRoutes` {#weapp-autoroutes}

- **类型**：`boolean | WeappAutoRoutesConfig`
- **默认值**：`false`

其中 `WeappAutoRoutesConfig` 为：

```ts
{
  enabled?: boolean
  typedRouter?: boolean
  include?: string | RegExp | Array<string | RegExp>
  persistentCache?: boolean | string
  watch?: boolean
}
```

作用：

- 从页面目录自动生成路由清单
- 输出 `.weapp-vite/typed-router.d.ts`
- 提供 `weapp-vite/auto-routes` 虚拟模块

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoRoutes: {
      enabled: true,
      typedRouter: true,
      include: ['pages/**'],
      persistentCache: true,
      watch: true,
    },
  },
})
```

字段说明：

- `enabled`：总开关
- `typedRouter`：是否输出路由类型文件
- `include`：扫描规则，支持 glob、正则和数组
- `persistentCache`：是否启用持久化缓存，或指定缓存文件路径
- `watch`：开发态是否监听页面目录变化

> [!TIP]
> 默认规则会扫描主包 `pages/**` 和已声明分包 root 下的 `pages/**`。如果你的页面目录不走这个约定，记得同步配置 `include` 和 `weapp.subPackages`。

## `weapp.debug` {#weapp-debug}

用于排查“为什么没扫描到”“为什么模块没被正确处理”“为什么某个环节很慢”。

主要钩子包括：

- `watchFiles`
- `resolveId`
- `load`
- `vueTransformTiming`
- `inspect`

```ts
export default defineConfig({
  weapp: {
    debug: {
      watchFiles(files, meta) {
        console.info(meta?.subPackage.root ?? 'main', files)
      },
      resolveId(id) {
        if (id.includes('tdesign')) {
          console.log('[resolveId]', id)
        }
      },
      inspect: {
        hooks: 'all',
      },
    },
  },
})
```

适用场景：

- 模块解析异常
- 构建卡顿定位
- 分包边界和监听文件排查
- Vue SFC 编译耗时定位

## `weapp.appPrelude` {#weapp-appprelude}

- **类型**：`boolean | { enabled?: boolean; mode?: 'inline' | 'entry' | 'require' }`

用于控制 `src/app.prelude.ts` / `src/app.prelude.js` 这类前置脚本的注入方式。

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      enabled: true,
      mode: 'inline',
    },
  },
})
```

字段说明：

- `enabled`：是否启用 `app.prelude` 注入；设为 `false` 时即使文件存在也不会注入
- `mode: 'inline'`：默认模式，把 prelude 代码内联到每个 JS chunk 顶部，执行时机最稳
- `mode: 'entry'`：只注入到 `app/page/component` 入口 chunk，适合希望减少重复代码的场景
- `mode: 'require'`：按主包 / 分包作用域额外产出 `app.prelude.js`，再在对应 chunk 顶部注入静态 `require(...)`，适合希望保留靠前执行时机并减少重复代码的场景

适用场景：

- 需要在任何业务入口之前先安装运行时全局
- 原生小程序项目里做 fetch / websocket / SDK 初始化
- 需要兼顾主包、普通分包与独立分包的前置执行

> [!NOTE]
> 当前 `app.prelude` 仅支持无 `import` / `export` 的自包含脚本。

## `weapp.logger` {#weapp-logger}

- **类型**：`LoggerConfig`

控制 CLI、构建器和分析命令的日志输出。

```ts
export default defineConfig({
  weapp: {
    logger: {
      level: 'info',
      tags: {
        build: true,
        mcp: false,
      },
    },
  },
})
```

它主要适合：

- CI 降噪
- 只打开特定子系统标签
- 本地排查时临时放大日志范围

## `weapp.forwardConsole` {#weapp-forwardconsole}

- **类型**：`boolean | WeappForwardConsoleConfig`

其中 `WeappForwardConsoleConfig` 为：

```ts
{
  enabled?: boolean | 'auto'
  logLevels?: Array<'debug' | 'log' | 'info' | 'warn' | 'error'>
  unhandledErrors?: boolean
}
```

用于把微信开发者工具中的运行时日志桥接回当前终端。

```ts
export default defineConfig({
  weapp: {
    forwardConsole: {
      enabled: 'auto',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    },
  },
})
```

常见用途：

- AI 联调时不来回切 DevTools 控制台
- 截图验收前同步观察页面日志和异常
- 远程协作时把小程序错误统一收敛到终端

相关命令：

```bash
wv dev --open
wv ide logs
wv ide logs --open
```

## `weapp.injectWeapi` {#weapp-injectweapi}

- **类型**：`boolean | { enabled?: boolean; replaceWx?: boolean; globalName?: string }`

用于注入 `@wevu/api` 运行时实例。

```ts
export default defineConfig({
  weapp: {
    injectWeapi: {
      enabled: true,
      replaceWx: false,
      globalName: 'wpi',
    },
  },
})
```

字段说明：

- `enabled`：是否启用注入
- `replaceWx`：是否同步替换全局 `wx`
- `globalName`：挂载到全局的变量名

适用场景：

- 团队统一走 `@wevu/api`
- 希望在运行时补齐一套更一致的 API 访问入口

## `weapp.injectRequestGlobals` {#weapp-injectrequestglobals}

- **类型**：`boolean | { enabled?: boolean; targets?: string[]; dependencies?: (string | RegExp)[] }`

用于为请求相关全局对象做注入，例如：

- `fetch`
- `Headers`
- `Request`
- `Response`
- `AbortController`
- `AbortSignal`
- `XMLHttpRequest`

```ts
export default defineConfig({
  weapp: {
    injectRequestGlobals: {
      enabled: true,
      targets: ['fetch', 'Headers', 'Request', 'Response'],
      dependencies: [/^axios$/, /^graphql-request$/],
    },
  },
})
```

适用场景：

- 需要在小程序环境兼容更多 Web 风格请求库
- 第三方依赖假设了浏览器请求全局已存在

> [!NOTE]
> 这里解决的是“运行时请求相关全局对象注入”，不是 Vite 顶层的 `define` 替换，也不是 polyfill 插件的通用替代品。

## `weapp.mcp` {#weapp-mcp}

- **类型**：`boolean | WeappMcpConfig`

其中 `WeappMcpConfig` 为：

```ts
{
  enabled?: boolean
  autoStart?: boolean
  host?: string
  port?: number
  endpoint?: string
}
```

用于控制本地 MCP 服务。

```ts
export default defineConfig({
  weapp: {
    mcp: {
      enabled: true,
      autoStart: true,
      host: '127.0.0.1',
      port: 8099,
      endpoint: '/mcp',
    },
  },
})
```

常见用途：

- AI 直接接管小程序打开、截图、截图对比、日志读取
- 本地协作工具调用 weapp-vite 提供的能力入口

如果你正在做 AI 亲和性增强，这一组配置通常和下面这些能力一起使用：

- `forwardConsole`
- 自动截图
- 截图对比
- `wv prepare`

## 这页和 Vite 原生配置的边界

以下字段不在这页定义，但经常会一起配：

- `server.host`
- `server.port`
- `define`
- `plugins`

这些仍然属于 Vite 顶层配置，请直接参考：

- [Vite 中文官方配置文档](https://cn.vite.dev/config/)

---

如果你下一步想继续接自动导入组件，请看 [自动导入组件配置](./auto-import-components.md)。如果你要处理 layout，则继续看 [Route Rules 与 Layout](./route-rules.md)。
