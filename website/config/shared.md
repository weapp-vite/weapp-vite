---
title: 共享配置
description: weapp-vite 的共享增强配置，包含自动路由、调试钩子、日志、forwardConsole、injectWeapi 与 MCP 等能力。
keywords:
  - Wevu
  - 配置
  - 调试
  - config
  - shared
  - 共享配置
  - 除了
---

# 共享配置 {#shared-config}

除了 WXML/WXS 这些“底层开关”，`weapp-vite` 还有一些通用增强能力，比如自动路由、调试钩子、MCP 与运行时注入。本页主要讲：

- `weapp.autoRoutes`：生成路由清单与类型，供 `app.json.ts` 或业务代码使用
- `weapp.debug`：遇到“为什么没扫描到 / 为什么没输出”时怎么定位
- `weapp.logger`：控制 CLI / 构建日志级别与标签输出
- `weapp.forwardConsole`：把微信开发者工具里的小程序日志桥接到终端
- `weapp.injectWeapi`：在运行时注入 `@wevu/api` 的 `wpi` 实例
- `weapp.mcp`：AI 协作时的 MCP 服务开关、自动启动与监听配置

> [!NOTE]
> 页面 `layout` 默认值不在本页配置，而是通过 [`weapp.routeRules`](/config/route-rules.md) 管理；运行时切换则由 `wevu` 的 `setPageLayout()` / `usePageLayout()` 负责。

组件自动导入已经拆到 [自动导入组件配置](/config/auto-import-components.md) 单独说明。
共享 chunk 策略已经拆到 [共享 Chunk 配置](/config/chunks.md) 单独说明。
`weapp.wevu.*` 已拆到 [Wevu 编译期配置](/config/wevu.md)，`weapp.hmr.*` 已拆到 [开发态 HMR 配置](/config/hmr.md)。

[[toc]]

## `weapp.autoRoutes` {#weapp-autoroutes}
- **类型**：`boolean | { enabled?: boolean; typedRouter?: boolean; include?: string | RegExp | Array<string | RegExp>; persistentCache?: boolean | string; watch?: boolean }`
- **默认值**：`false`
- **适用场景**：
  - 希望从目录结构自动生成 `pages` 清单，不再手动维护 `app.json.pages`。
  - 希望在 TypeScript 里拿到“页面路径”的类型提示，避免字符串拼错。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoRoutes: {
      enabled: true,
      typedRouter: true,
      include: ['pages/**'],
      persistentCache: false,
      watch: true,
    },
  },
})
```

如果只是快速启用，也可以直接写：

```ts
export default defineConfig({
  weapp: {
    autoRoutes: true,
  },
})
```

开启后 Weapp-vite 会：

- 持续扫描主包和分包下的页面目录，维护 `routes`、`entries`、`pages`、`subPackages` 等清单；
- 在 `.weapp-vite/typed-router.d.ts` 输出类型文件，提供 `AutoRoutes` 等类型；
- 自动暴露虚拟模块 `weapp-vite/auto-routes`，支持在代码中直接导入最新的路由数据。

字段说明：

- `enabled`：总开关；设为 `false` 时完全关闭自动路由。
- `typedRouter`：是否输出 `typed-router.d.ts`。
- `include`：自动路由扫描规则。支持单个 glob、正则或它们的数组；默认是主包 `pages/**`，并额外包含已声明分包 root 下的 `pages/**`。
- `persistentCache`：是否启用持久化缓存；传 `true` 时使用默认 `.weapp-vite/auto-routes.cache.json`，传字符串时表示自定义缓存文件路径，默认关闭。
- `watch`：开发模式下是否监听页面目录变化并实时刷新路由清单。

> [!NOTE]
> 自动路由默认扫描 `srcRoot/pages/**`，以及已声明分包 root 下的 `pages/**`。它不会把任意 `**/pages/**` 都当作页面目录；如果目录结构不同，可以通过 `include` 自定义 glob / 正则规则。分包页面若不再使用 `root/pages/**` 约定，建议同时声明 `weapp.subPackages`，这样 `autoRoutes` 才能稳定推断 `subPackages` 输出。

> [!TIP]
> 如果你在 `src/subpackages/foo/pages/**`、`src/packageA/pages/**` 这类目录下放页面，但没有在 `weapp.subPackages` 中声明对应 root，那么这些页面在默认规则下不会被自动收集。要么补 `weapp.subPackages`，要么显式配置 `autoRoutes.include`。

> [!TIP]
> 如果你希望在 `dev/build` 之前就把自动路由类型文件生成出来，可以手动执行 `weapp-vite prepare`。

## `weapp.debug` {#weapp-debug}
- **类型**：
  ```ts
  {
    watchFiles?: (files: string[], meta?: SubPackageMetaValue) => void
    resolveId?: (id: string, meta?: SubPackageMetaValue) => void
    load?: (id: string, meta?: SubPackageMetaValue) => void
    vueTransformTiming?: (timing: {
      id: string
      isPage: boolean
      totalMs: number
      stages: Record<string, number>
    }) => void
    inspect?: WrapPluginOptions
  }
  ```
- **适用场景**：排查“监听了哪些文件”“模块是怎么解析的”“某个文件有没有走到预期插件”“产物为什么没生成”等问题。

### 调试示例

```ts
export default defineConfig({
  weapp: {
    debug: {
      watchFiles(files, meta) {
        const scope = meta?.subPackage.root ?? 'main'
        console.info(`[watch:${scope}]`, files)
      },
      resolveId(id) {
        if (id.includes('lodash')) {
          console.log('[resolveId]', id)
        }
      },
      load(id) {
        if (id.endsWith('.wxml')) {
          console.log('[load wxml]', id)
        }
      },
      inspect: { hooks: 'all', threshold: 16 },
    },
  },
})
```

- `watchFiles`: 构建结束时返回监听到的文件，可区分主包与分包。
- `resolveId`: 追踪模块解析路径，适合定位别名、入口解析或分包引用问题。
- `load`: 监听模块加载，常用于确认模板、脚本等是否经过预期的转换。
- `vueTransformTiming`: 输出 `.vue` 文件编译分阶段耗时，适合定位模板编译、脚本转换或布局注入的热点。
- `inspect`: 基于 `vite-plugin-performance` 的 `wrapPlugin` 能力，记录插件钩子的耗时与调用情况（默认输出到控制台）。

### 常见调试技巧

1. **确认分包有没有参与构建**：用 `watchFiles` 看看独立分包的 `miniprogram_npm` 是否生成、文件是否被监听到。
2. **定位构建卡顿**：在 `resolveId` / `load` 里打时间戳，快速找出慢的模块或目录。
3. **排查组件自动导入**：组件没被识别时，先确认 `.json` 是否包含 `component: true`，再看 `autoImportComponents.globs` 是否命中。

## `weapp.logger` {#weapp-logger}
- **类型**：`LoggerConfig`
- **作用**：透传给 `@weapp-core/logger`，统一控制 `weapp-vite` CLI、构建器和分析命令的日志输出。

```ts
import { defineConfig } from 'weapp-vite/config'

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

适用场景：
- CI 中希望减少冗余日志，只保留警告/错误。
- 本地调试时希望只打开构建、分析或特定子系统的日志标签。

> [!TIP]
> 字段细节以 `@weapp-core/logger` 的类型提示为准；`weapp-vite` 这里只做透传，不额外扩展私有字段。

## `weapp.forwardConsole` {#weapp-forwardconsole}
- **类型**：`boolean | { enabled?: boolean | 'auto'; logLevels?: Array<'debug' | 'log' | 'info' | 'warn' | 'error'>; unhandledErrors?: boolean }`
- **默认值**：`{ enabled: 'auto', logLevels: ['log', 'info', 'warn', 'error'], unhandledErrors: true }`
- **适用场景**：
  - 希望把微信开发者工具里的小程序 `console.log / warn / error` 直接输出到当前终端。
  - 希望在 AI 终端里做联调、截图验收或自动化排障时，减少来回切换 DevTools 控制台。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

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

始终开启：

```ts
export default defineConfig({
  weapp: {
    forwardConsole: true,
  },
})
```

完全关闭：

```ts
export default defineConfig({
  weapp: {
    forwardConsole: false,
  },
})
```

### 字段说明

1. `enabled`：
   - `true`：始终开启
   - `false`：始终关闭
   - `'auto'`：仅在检测到 AI 终端时开启
2. `logLevels`：允许转发的日志级别集合。
3. `unhandledErrors`：是否同时转发未捕获异常。

### 触发方式

1. 自动模式：执行 `weapp-vite dev --open`，当目标平台是 `weapp` 且 `forwardConsole` 生效时，会在打开 DevTools 后自动尝试附加日志桥。
2. 手动模式：执行 `weapp-vite ide logs`，进入持续监听状态；可配合 `--open` 先打开 DevTools。

```bash
weapp-vite dev --open
weapp-vite ide logs
weapp-vite ide logs --open
```

### 推荐配套命令

如果你正在做 AI 联调、运行时排障或截图验收，通常会和下面几个命令一起使用：

```bash
weapp-vite dev --open
weapp-vite ide logs --open
weapp-vite screenshot --project ./dist/build/mp-weixin --json
weapp-vite compare --project ./dist/build/mp-weixin --baseline .screenshots/baseline/index.png --max-diff-pixels 100 --json
```

### 注意事项

- 当前只支持微信小程序平台。
- 自动附加失败时，会回退到普通 `open` 流程，不影响原有开发命令。
- `weapp-vite ide logs` 是常驻命令，需要通过 `Ctrl+C` 主动退出。

## `weapp.injectWeapi` {#weapp-injectweapi}
- **类型**：`boolean | { enabled?: boolean; replaceWx?: boolean; globalName?: string }`
- **默认值**：`{ enabled: false, replaceWx: false, globalName: 'wpi' }`
- **作用**：在 App 入口注入 `@wevu/api` 导出的 `wpi` 实例；可选地把全局 `wx` / `my` / 当前平台对象代理到该实例上。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

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

### 字段说明

1. `enabled`：是否启用 `wpi` 注入。
2. `replaceWx`：是否把源码中的 `wx` / `my` / 当前平台全局对象访问重写到注入实例。
3. `globalName`：挂到全局对象上的变量名，默认是 `wpi`。

### 使用建议

- 仅想在运行时全局暴露 `wpi`，但不改动现有 `wx.xxx` 调用：`enabled: true, replaceWx: false`。
- 想统一走 `@wevu/api` 的适配层：再开启 `replaceWx: true`。
- 若项目未安装 `@wevu/api`，构建时会跳过注入并给出告警。

## `weapp.mcp` {#weapp-mcp}
- **类型**：`boolean | { enabled?: boolean; autoStart?: boolean; host?: string; port?: number; endpoint?: string }`
- **默认值**：`{ enabled: true, autoStart: false, host: '127.0.0.1', port: 3088, endpoint: '/mcp' }`
- **适用场景**：
  - 需要让 AI 助手直接读取仓库源码与文档。
  - 希望在本地开发时按需自动拉起 MCP HTTP 服务。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: {
      enabled: true,
      autoStart: true,
      host: '127.0.0.1',
      port: 3088,
      endpoint: '/mcp',
    },
  },
})
```

关闭自动启动（保留手动 `weapp-vite mcp`）：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: {
      autoStart: false,
    },
  },
})
```

完全关闭 MCP：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: false,
  },
})
```

### 字段说明

1. `enabled`: 是否启用 MCP 能力。
2. `autoStart`: 是否在 `weapp-vite` 原生命令执行时自动启动 MCP HTTP 服务。
3. `host/port/endpoint`: 自动启动时的监听地址配置。

> [!TIP]
> 完整接入流程、客户端配置与测试建议请看：[AI 协作指南](/guide/ai)。

### 当前推荐的 AI 使用方式

如果你希望 AI 更稳定地命中小程序运行时能力，建议优先让它：

1. 先读取根目录 `AGENTS.md`
2. 再读取 `node_modules/weapp-vite/dist/docs/*.md`
3. 对截图使用 `take_weapp_screenshot` 或 `weapp-vite screenshot`
4. 对截图对比使用 `compare_weapp_screenshot` 或 `weapp-vite compare`

这样通常比直接让 AI 自己猜“该用浏览器截图还是 DevTools automator”更稳定。

## 关联阅读

- [WXML 配置](/config/wxml.md)：了解模板增强与组件扫描的协作方式。
- [WXS 配置](/config/wxs.md)：掌握脚本增强开关与调试方法。
- [npm 配置](/config/npm.md)：在调试过程中同时控制 npm 构建策略。
- [共享 Chunk 配置](/config/chunks.md)：控制跨分包共享代码如何输出与治理。
- [Wevu 编译期配置](/config/wevu.md)：查看 `weapp.wevu.defaults / preset / autoSetDataPick`。
- [开发态 HMR 配置](/config/hmr.md)：查看 `weapp.hmr.sharedChunks / touchAppWxss`。
