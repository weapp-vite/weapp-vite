---
title: Web 运行时配置 experimental
description: weapp-vite 可选集成浏览器端运行时 @weapp-vite/web，用于预览、兼容验证、截图联调与 AI 调试。
keywords:
  - 配置
  - config
  - web
  - 运行时
  - experimental
  - AI
---

# Web 运行时配置 <span class="wv-badge wv-badge--experimental">experimental</span> {#web-config}

`weapp.web` 用于接入浏览器端运行时（`@weapp-vite/web`），让你在 Web 环境里做这些事：

- 快速预览页面结构和样式
- 调试模板编译与运行时表达式
- 做兼容验证
- 在 AI 联调、截图、截图对比前先跑一轮浏览器链路

> [!WARNING]
> `weapp.web` 仍是实验能力。它适合开发和调试，不应作为小程序真机或 DevTools 验收的唯一依据。

[[toc]]

## `weapp.web` {#weapp-web}

- **类型**：
  ```ts
  {
    enable?: boolean
    root?: string
    srcDir?: string
    outDir?: string
    pluginOptions?: Partial<Omit<WeappWebPluginOptions, 'srcDir'>>
    vite?: InlineConfig
  }
  ```

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    web: {
      enable: true,
      root: '.',
      srcDir: 'src',
      outDir: 'dist/web',
      pluginOptions: {
        wxss: {
          designWidth: 750,
        },
        form: {
          preventDefault: true,
        },
        runtime: {
          executionMode: 'safe',
          warnings: {
            level: 'warn',
            dedupe: true,
          },
        },
      },
      vite: {
        server: {
          host: true,
          port: 5173,
        },
      },
    },
  },
})
```

## 字段说明

### `enable`

- **类型**：`boolean`

控制是否启用 Web 运行时。

通常只要配置了 `weapp.web` 且 `enable !== false`，它就会生效。

### `root`

- **类型**：`string`

Web 项目根目录，通常是 `index.html` 所在目录。

### `srcDir`

- **类型**：`string`

Web 运行时侧使用的小程序源码目录。默认会尽量与 `weapp.srcRoot` 保持一致。

### `outDir`

- **类型**：`string`

Web 产物输出目录，默认一般是 `dist/web`。

### `pluginOptions`

- **类型**：`Partial<Omit<WeappWebPluginOptions, 'srcDir'>>`

透传给 `@weapp-vite/web` 插件层。

常见字段包括：

- `wxss`
- `form`
- `runtime`

其中比较关键的是：

- `runtime.executionMode`
  - `compat`
  - `safe`
  - `strict`
- `runtime.warnings.level`
  - `warn`
  - `error`
  - `off`
- `runtime.warnings.dedupe`

### `vite`

- **类型**：`InlineConfig`

允许你给 Web 运行时单独合并一份 Vite 配置。

常见场景：

- 单独配 Web 的 `server.port`
- 单独配 `resolve.alias`
- 单独加浏览器调试插件

> [!TIP]
> `weapp.web.vite` 里的字段完全遵循 Vite 原生语义。完整说明请看 [Vite 中文官方配置文档](https://cn.vite.dev/config/)。

## 什么时候适合开启

- 你想更快观察模板和交互，而不是每次都回到开发者工具
- 你在做 AI 联调，希望把“截图前的预检”搬到浏览器环境
- 你在查兼容问题，想先缩小到“编译问题”还是“平台问题”

## 和截图 / AI 联调的关系

如果你的目标是增强 AI 对项目的可操作性，`weapp.web` 很适合当第一层调试面：

- 先在 Web 侧打开页面
- 再配合浏览器截图或截图对比能力做快速回归
- 最后再回 DevTools / 真机验证平台差异

这能显著减少“每次截图都必须依赖小程序 IDE”的成本。

## 与 Vite 顶层配置的边界

这组配置只描述“Web 运行时这条附加链路”。

如果你要配置这些原生字段：

- `server`
- `resolve`
- `plugins`
- `css`
- `build`

请直接参考：

- [Vite 中文官方配置文档](https://cn.vite.dev/config/)

---

如果你接下来要处理截图联调、MCP、日志桥接，请回看 [共享配置](./shared.md)。如果你要处理多入口发布，则继续看 [库模式配置](./lib.md)。
