---
title: 共享配置
description: 除了 WXML/WXS 这些“底层开关”，Weapp-vite 还有一些通用增强能力，比如自动路由、调试钩子等。本页主要讲：
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

除了 WXML/WXS 这些“底层开关”，`weapp-vite` 还有一些通用增强能力，比如自动路由、调试钩子等。本页主要讲：

- `weapp.autoRoutes`：生成路由清单与类型，供 `app.json.ts` 或业务代码使用
- `weapp.debug`：遇到“为什么没扫描到 / 为什么没输出”时怎么定位
- `weapp.mcp`：AI 协作时的 MCP 服务开关与监听配置

组件自动导入已经拆到 [自动导入组件配置](/config/auto-import-components.md) 单独说明。

[[toc]]

## `weapp.autoRoutes` {#weapp-autoroutes}
- **类型**：`boolean`
- **默认值**：`false`
- **适用场景**：
  - 希望从目录结构自动生成 `pages` 清单，不再手动维护 `app.json.pages`。
  - 希望在 TypeScript 里拿到“页面路径”的类型提示，避免字符串拼错。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoRoutes: true,
  },
})
```

开启后 Weapp-vite 会：

- 持续扫描主包和分包下的页面目录，维护 `routes`、`entries`、`pages`、`subPackages` 等清单；
- 在配置文件同级输出 `typed-router.d.ts`，提供 `AutoRoutes` 等类型；
- 自动暴露虚拟模块 `weapp-vite/auto-routes`，支持在代码中直接导入最新的路由数据。

> [!NOTE]
> 自动路由只扫描 `srcRoot` 下的 `pages/` 目录（含 `packages/foo/pages` 这类分包结构），**不支持 `include/exclude` 自定义规则**。若目录结构完全不同，请继续手写 `app.json.pages`，或在 `app.json.ts` 中手动引入 `weapp-vite/auto-routes` 生成页面清单。

## `weapp.debug` {#weapp-debug}
- **类型**：
  ```ts
  {
    watchFiles?: (files: string[], meta?: SubPackageMetaValue) => void
    resolveId?: (id: string, meta?: SubPackageMetaValue) => void
    load?: (id: string, meta?: SubPackageMetaValue) => void
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
- `inspect`: 基于 `vite-plugin-performance` 的 `wrapPlugin` 能力，记录插件钩子的耗时与调用情况（默认输出到控制台）。

### 常见调试技巧

1. **确认分包有没有参与构建**：用 `watchFiles` 看看独立分包的 `miniprogram_npm` 是否生成、文件是否被监听到。
2. **定位构建卡顿**：在 `resolveId` / `load` 里打时间戳，快速找出慢的模块或目录。
3. **排查组件自动导入**：组件没被识别时，先确认 `.json` 是否包含 `component: true`，再看 `autoImportComponents.globs` 是否命中。

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

## `weapp.wevu.defaults` {#weapp-wevu-defaults}
- **类型**：`WevuDefaults`
- **作用**：在编译 `app.vue` 时自动注入 `setWevuDefaults()`，统一控制 Wevu 的 `createApp/defineComponent` 默认值。
- **适用场景**：
  - 希望全局配置 `setData` 策略（例如 `includeComputed` / `strategy`）。
  - 希望统一小程序 `Component` 选项默认值（例如 `options.addGlobalClass`）。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      defaults: {
        app: {
          setData: {
            includeComputed: false,
            strategy: 'patch',
          },
        },
        component: {
          options: {
            addGlobalClass: true,
          },
          setData: {
            strategy: 'patch',
          },
        },
      },
    },
  },
})
```

### 注意事项

- 仅对 `app.vue` 生效：Weapp-vite 会在编译产物中插入 `setWevuDefaults()`，并确保它在 `createApp()` 之前执行。
- 配置必须可序列化（JSON 兼容）：不支持函数、`Symbol`、循环引用。
- 局部显式配置会覆盖默认值；`setData` 与 `options` 会做浅合并，其余字段按对象顶层合并。
- 若你希望手动控制时机，可以在 `app.vue` 顶层显式调用 `setWevuDefaults()`，并关闭此配置以避免重复注入。
- 当 `app.vue`/组件导出为对象字面量时，Weapp-vite 会把默认值直接合并进编译产物，方便排查与调试；若导出是变量或函数，仍会回落到运行时合并。
- 若设置了 `component.options.virtualHost = true`，Weapp-vite 会在 **页面** 入口自动补上 `virtualHost: false`，避免页面虚拟节点导致的渲染层错误；需要为页面开启时请在页面内显式配置。

> [!TIP]
> 如果你不通过 Weapp-vite 构建，也可以在运行时手动调用 `setWevuDefaults()`（见 `/wevu/runtime`）。

## `weapp.hmr.sharedChunks` {#weapp-hmr-sharedchunks}
- **类型**：`'full' | 'auto' | 'off'`
- **默认值**：`'auto'`
- **适用场景**：开发态 HMR 时控制共享 chunk 的重建策略。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      sharedChunks: 'auto',
    },
  },
})
```

- `full`: 每次更新都重新产出全部 entry（最稳、最慢）。
- `auto`: 只在共享 chunk 可能被覆盖时回退 full（折中）。
- `off`: 仅更新变更 entry（最快，但可能导致共享 chunk 导出不一致）。

## `weapp.hmr.touchAppWxss` {#weapp-hmr-touchappwxss}
- **类型**：`boolean | 'auto'`
- **默认值**：`'auto'`
- **适用场景**：开发态构建结束后，额外触碰 `app.wxss`，触发微信开发者工具的热重载。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      touchAppWxss: 'auto',
    },
  },
})
```

- `true`: 总是启用。
- `false`: 关闭。
- `auto`: 检测到安装 `weapp-tailwindcss` 时启用。

## `weapp.chunks` {#weapp-chunks}
- **类型**：`ChunksConfig`
- **适用场景**：控制跨分包共享代码如何输出，降低重复体积或减少主包依赖。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'common',
      sharedOverrides: [{ test: 'components/**', mode: 'path' }],
      sharedPathRoot: 'src',
      dynamicImports: 'preserve',
      logOptimization: true,
      forceDuplicatePatterns: ['components/**', /legacy\//],
      duplicateWarningBytes: 512 * 1024,
    },
  },
})
```

字段说明：

- `sharedStrategy`: `duplicate`（默认）复制到各分包，或 `hoist` 提到主包。
- `sharedMode`: `common`（默认）输出 `common.js`，`path` 按源码路径输出，`inline` 内联到引用方。
- `sharedOverrides`: 针对特定模块覆盖 `sharedMode` 的规则数组（`test` 支持字符串或正则）。
- `sharedPathRoot`: `sharedMode: 'path'` 时用于计算输出路径的根目录（相对 `cwd`）。
- `dynamicImports`: `preserve`（默认）保留动态 chunk，`inline` 尝试内联动态 import。
- `logOptimization`: 输出分包优化日志，帮助确认复制/回退位置。
- `forceDuplicatePatterns`: 强制按分包复制的模块匹配规则（字符串或正则）。
- `duplicateWarningBytes`: 冗余体积超过阈值时发出警告；设置为 `0` 关闭。

详细用法与示例请参考：[共享 Chunk 策略](/guide/chunks)。

## 关联阅读

- [WXML 配置](/config/wxml.md)：了解模板增强与组件扫描的协作方式。
- [WXS 配置](/config/wxs.md)：掌握脚本增强开关与调试方法。
- [npm 配置](/config/npm.md)：在调试过程中同时控制 npm 构建策略。
