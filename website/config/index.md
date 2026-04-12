---
title: 配置概览
description: weapp-vite 基于 Vite 配置模型扩展 weapp 字段，统一管理小程序构建、自动路由、自动导入、MCP、Web 运行时与库模式等能力。
keywords:
  - 配置
  - config
  - 配置概览
  - weapp-vite
  - autoRoutes
  - autoImportComponents
  - MCP
  - web
---

# 配置概览 {#config-overview}

`weapp-vite` 采用 **Vite 顶层配置 + `weapp` 小程序专属配置** 的组合模型：

- 顶层字段仍然是标准 Vite 配置，例如 `build`、`resolve`、`css`、`server`
- 小程序专属字段放在 `weapp` 下，例如 `srcRoot`、`autoRoutes`、`subPackages`、`mcp`

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    sourcemap: true,
  },
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
  },
})
```

> [!NOTE]
> 除了 `vite.config.*`，你也可以额外提供 `weapp-vite.config.*`。`weapp-vite` 会读取其中的 `weapp` 配置，再与 `vite.config.*` 合并，适合把“小程序专属配置”和“通用 Vite 配置”拆开维护。

> [!TIP]
> 配置文件以 ESM 方式执行。需要绝对路径时，优先使用 `import.meta.dirname`，或基于 `import.meta.url` 自行转换。

[[toc]]

## 先分清两类配置

### 看本目录的场景

当你在配置这些能力时，优先看 `/config/*`：

- 小程序源码入口、插件入口、静态资源复制
- 自动路由、自动导入组件、分包、共享 chunk
- Vue SFC / Wevu 编译期增强
- 托管 TypeScript 支持文件
- MCP、日志转发、运行时注入
- Web 运行时、库模式、worker 构建

### 看 Vite 官方配置的场景

当你在配置这些标准 Vite 能力时，优先看 Vite 中文官方配置文档：

- `root`
- `resolve.alias`
- `define`
- `css`
- `server`
- `plugins`
- `build`
- `optimizeDeps`
- `worker`

官方入口：

- [Vite 中文官方配置文档](https://cn.vite.dev/config/)

> [!TIP]
> `weapp-vite` 不会重新发明一套 `build` / `server` / `resolve` API。文档里提到这些字段时，通常只解释“它在小程序链路里要注意什么”，更完整的字段定义请以 Vite 官方文档为准。

## `defineConfig` 推荐写法

推荐始终从 `weapp-vite/config` 导入 `defineConfig`，而不是直接从 `vite` 导入。这样 `weapp` 字段能拿到完整的类型提示、JSDoc 和跳转能力。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(env => ({
  weapp: {
    srcRoot: env.command === 'build' ? 'src' : 'src',
  },
}))
```

支持的主要形态包括：

- 对象配置
- `Promise` 对象配置
- 同步函数配置
- 异步函数配置
- 带 `env` 的同步/异步函数配置

深入说明请看：

- [defineConfig 重载与类型推导说明](https://github.com/weapp-vite/weapp-vite/blob/main/packages/weapp-vite/docs/define-config-overloads.md)

## 推荐阅读顺序

1. 先看 [基础目录与资源收集](./paths.md)、[构建输出与兼容](./build-and-output.md)、[TypeScript 支持文件](./typescript.md)，把目录、输出、类型支持先稳定下来。
2. 再看 [共享配置](./shared.md)、[自动导入组件配置](./auto-import-components.md)、[分包配置](./subpackages.md)、[共享 Chunk 配置](./chunks.md)，接入增强能力。
3. 最后再看 [Vue SFC 配置](./vue.md)、[Wevu 编译期配置](./wevu.md)、[Web 运行时配置](./web.md)、[库模式配置](./lib.md) 这些偏进阶链路。

## 按场景找配置

| 场景 | 建议先看 |
| --- | --- |
| 刚接入项目，先让目录、输出、TS 提示稳定 | [基础目录与资源收集](./paths.md)、[构建输出与兼容](./build-and-output.md)、[TypeScript 支持文件](./typescript.md) |
| 想减少手写 `app.json.pages` / `usingComponents` | [共享配置](./shared.md)、[自动导入组件配置](./auto-import-components.md) |
| 想按目录批量套 layout | [Route Rules 与 Layout](./route-rules.md) |
| 项目有分包、独立分包、共享样式或分包独立 npm | [分包配置](./subpackages.md)、[npm 配置](./npm.md)、[共享 Chunk 配置](./chunks.md) |
| 使用 Vue SFC / Wevu，需要调模板编译、setData 策略或 HMR | [Vue SFC 配置](./vue.md)、[Wevu 编译期配置](./wevu.md)、[开发态 HMR 配置](./hmr.md) |
| 想做浏览器预览、AI 协作、截图、日志桥接 | [共享配置](./shared.md)、[Web 运行时配置](./web.md) |
| 想做小程序组件库或业务模块库 | [库模式配置](./lib.md) |

## 配置索引

| 主题 | 内容概览 |
| --- | --- |
| [基础目录与资源收集](./paths.md) | `srcRoot` / `pluginRoot` / `copy` / `isAdditionalWxml` |
| [构建输出与兼容](./build-and-output.md) | `platform` / `multiPlatform` / `jsFormat` / `cleanOutputsInDev` / `packageSizeWarningBytes` / 顶层 `build.*` |
| [TypeScript 支持文件](./typescript.md) | `.weapp-vite/tsconfig.*`、托管类型输出、`weapp.typescript` |
| [共享配置](./shared.md) | `autoRoutes` / `debug` / `logger` / `appPrelude` / `forwardConsole` / `injectWeapi` / `injectWebRuntimeGlobals` / `mcp` |
| [Route Rules 与 Layout](./route-rules.md) | `weapp.routeRules`、layout 默认值、`layouts/` 约定 |
| [JSON 配置](./json.md) | `jsonAlias` / `json.defaults` / `json.mergeStrategy` |
| [JS 配置](./js.md) | `tsconfigPaths` / `ast` 与顶层 `resolve.alias` 的边界 |
| [Vue SFC 配置](./vue.md) | `weapp.vue.template`、模板编译开关、自动导入保留字段 |
| [Wevu 编译期配置](./wevu.md) | `weapp.wevu.preset` / `defaults` / `autoSetDataPick` |
| [开发态 HMR 配置](./hmr.md) | `weapp.hmr.sharedChunks` / `touchAppWxss` |
| [分包配置](./subpackages.md) | `weapp.subPackages`、共享样式、分包级 `inlineConfig` |
| [Worker 配置](./worker.md) | `weapp.worker.entry` |
| [库模式配置](./lib.md) | `weapp.lib` 入口、路径、组件 JSON 与 DTS |
| [生成脚手架配置](./generate.md) | `weapp.generate` 目录、后缀、文件名、模板 |
| [npm 配置](./npm.md) | `weapp.npm` 依赖落位、缓存、支付宝 npm 模式、构建覆盖 |
| [WXML 配置](./wxml.md) | `weapp.wxml` 扫描与模板处理入口 |
| [WXS 配置](./wxs.md) | `weapp.wxs` 与 Vue class/style 运行时的关系 |
| [自动导入组件配置](./auto-import-components.md) | `weapp.autoImportComponents` 字段与产物输出 |
| [共享 Chunk 配置](./chunks.md) | `weapp.chunks` 共享策略、输出形态与优化日志 |
| [Web 运行时配置](./web.md) | `weapp.web` 浏览器预览与调试 |

## 常见边界问题

### `weapp` 和顶层 `build` / `resolve` 会冲突吗

通常不会。

- `weapp` 负责小程序特有能力
- 顶层 `build` / `resolve` / `css` / `server` 继续按 Vite 规则工作

如果一个功能同时涉及两边：

- 先用 `weapp` 定义小程序语义
- 再用顶层 Vite 配置调整底层构建行为

例如：

- `weapp.lib` 决定“进入库模式”
- 顶层 `build.rolldownOptions` 决定 external、chunk、输出细节

### 配置改了但编辑器没提示

优先排查这几项：

1. 是否从 `weapp-vite/config` 导入 `defineConfig`
2. 是否已经执行过 `wv prepare`
3. 根 `tsconfig.json` 是否包含 `.weapp-vite` 生成的引用或类型输出
4. 是否误把小程序字段写到了 Vite 顶层，而不是 `weapp` 下

### 不知道一个字段到底归谁管

可以用这个经验法则：

- 只和小程序构建/运行语义有关，通常在 `weapp.*`
- 只和 Vite/Rolldown 服务、解析、打包行为有关，通常在 Vite 顶层

---

如果你不确定从哪一页开始，先看 **基础目录与资源收集**、**构建输出与兼容**、**共享配置**。这三页基本覆盖了项目刚接入或升级时最容易踩坑的部分。
