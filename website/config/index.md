---
title: 配置概览
description: weapp-vite 基于 Vite 配置模型扩展 weapp 字段，统一管理小程序构建、自动路由、自动导入、MCP、Web 运行时与库模式等能力。
keywords:
  - 配置
  - config
  - 配置概览
  - Weapp-vite
  - autoRoutes
  - autoImportComponents
  - MCP
  - web
---

# 配置概览 {#config-overview}

`weapp-vite` 使用 **Vite 配置模型**：在 `vite.config.ts` 中增加一个 `weapp` 字段即可。你也可以把小程序专属配置拆到 `weapp-vite.config.*`，两者会合并。

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  // 这里依然可以写任意 Vite 配置
  weapp: {
    // 小程序专属配置写在这里
  },
})
```

> [!NOTE]
> 配置文件以 **ESM** 方式执行。若需要绝对路径，推荐使用 `import.meta.dirname`（本仓库与脚手架默认提供）或 `fileURLToPath(import.meta.url)`。

> [!TIP]
> 你可以额外创建 `weapp-vite.config.ts`（或 `.mts/.cts/.js/.mjs/.cjs/.json`）。`weapp-vite` 会先读取其中的 `weapp` 配置，再与 `vite.config.*` 合并，便于把「小程序配置」与「通用 Vite 配置」分开维护。

[[toc]]

## 推荐阅读顺序

1. **先对齐目录与输出**：如果 `app.json` 不在根目录，先看 [`weapp.srcRoot`](./paths.md#weapp-srcroot)；输出目录与 `project.config.json` 的 `miniprogramRoot` 强相关，详见 [构建输出与兼容](./build-and-output.md)。
2. **再启用增量能力**：自动导入组件、自动路由、共享 chunk、MCP 这类能力都建立在前面的目录与输出路径正确之上。
3. **最后再看实验特性**：`weapp.web`、`wxs` 等能力适合在主链路稳定后按需启用。

## 按场景找配置

| 场景 | 建议先看 |
| --- | --- |
| 刚接入项目，先让目录、输出、TS 提示稳定 | [基础目录与资源收集](./paths.md)、[构建输出与兼容](./build-and-output.md)、[TypeScript 支持文件](./typescript.md) |
| 想减少手写 `app.json.pages` / `usingComponents` | [共享配置](./shared.md)、[自动导入组件配置](./auto-import-components.md) |
| 想给页面统一套 `layout`，或按路由批量指定页面外壳 | [Route Rules 与 Layout](./route-rules.md) |
| 项目有分包、独立分包、共享样式或分包特化自动导入 | [分包配置](./subpackages.md)、[npm 配置](./npm.md)、[共享 Chunk 配置](./chunks.md) |
| 在 Vue SFC / Wevu 项目里调模板编译与运行时默认值 | [Vue SFC 配置](./vue.md)、[共享配置](./shared.md) |
| 想做组件库、多入口模块输出或 DTS 构建 | [库模式配置](./lib.md) |
| 想做浏览器预览、AI 协作或本地 MCP | [Web 运行时配置](./web.md)、[共享配置](./shared.md) |

## 配置索引

| 主题 | 内容概览 |
| --- | --- |
| [基础目录与资源收集](./paths.md) | `srcRoot` / `pluginRoot` / 静态资源拷贝 / 预留字段 |
| [构建输出与兼容](./build-and-output.md) | `jsFormat` / `es5` / `multiPlatform` / 输出目录推导 |
| [TypeScript 支持文件](./typescript.md) | `.weapp-vite/tsconfig.*`、托管引用、编辑器类型支持 |
| [Route Rules 与 Layout](./route-rules.md) | `weapp.routeRules`、页面 layout 默认值、`layouts/` 约定 |
| [JSON 配置](./json.md) | `jsonAlias` / JSON 默认值 / 合并策略 |
| [JS 配置](./js.md) | `tsconfigPaths`、脚本侧解析行为 |
| [Vue SFC 配置](./vue.md) | `weapp.vue.template` 模板编译与 class/style 运行时 |
| [分包配置](./subpackages.md) | 独立/普通分包、`inlineConfig`、共享样式 |
| [Worker 配置](./worker.md) | Worker 入口与构建输出 |
| [库模式配置](./lib.md) | `weapp.lib` 入口、路径保持、组件 JSON 与 DTS |
| [生成脚手架配置](./generate.md) | `weapp.generate` 目录结构、后缀与模板定制 |
| [npm 配置](./npm.md) | 自动/手动构建、主包/分包依赖落位、缓存与优化 |
| [WXML 配置](./wxml.md) | WXML 扫描与模板处理行为 |
| [WXS 配置](./wxs.md) <span class="wv-badge wv-badge--experimental">experimental</span> | WXS 处理与调试建议 |
| [自动导入组件配置](./auto-import-components.md) | `weapp.autoImportComponents` 字段与产物输出 |
| [共享 Chunk 配置](./chunks.md) | `weapp.chunks` 的输出策略、`common.js` 治理、分包共享优化 |
| [共享配置](./shared.md) | 自动路由、日志、`injectWeapi`、MCP 与辅助支持文件 |
| [Web 运行时配置](./web.md) <span class="wv-badge wv-badge--experimental">experimental</span> | `weapp.web` 浏览器端预览与调试 |

> 仍在寻找 Vite 原生配置？可直接参考 [Vite 官方配置文档](https://cn.vitejs.dev/config/)。

---

如果你不确定从哪里开始，建议先看 **基础目录与资源收集**、**构建输出与兼容**、**共享配置** 这三页。前两页决定项目能不能稳定跑起来，后一页决定你怎么接入当前版本最有价值的增强能力。
