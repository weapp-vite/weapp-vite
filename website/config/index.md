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

## 你最可能先要改的 3 项

1. **源码目录**：`app.json` 不在根目录时，先配 [`weapp.srcRoot`](./paths.md#weapp-srcroot)。
2. **输出目录**：由 `project.config.json` 的 `miniprogramRoot` 决定，详见 [构建输出与兼容](./build-and-output.md)。
3. **自动导入组件**：默认已开启（扫描 `components/**/*.wxml`），详见 [自动导入组件配置](./auto-import-components.md)。

## 配置索引

| 主题 | 内容概览 |
| --- | --- |
| [基础目录与资源收集](./paths.md) | `srcRoot` / `pluginRoot` / 静态资源拷贝 / 预留字段 |
| [构建输出与兼容](./build-and-output.md) | `jsFormat` / `es5` / 输出目录推导 / 多端输出规则 |
| [JSON 配置](./json.md) | `jsonAlias` / JSON 默认值 / 合并策略 |
| [JS 配置](./js.md) | `tsconfigPaths`（vite-tsconfig-paths） |
| [Vue SFC 配置](./vue.md) | `weapp.vue` 模板编译与 class/style 运行时 |
| [分包配置](./subpackages.md) | 独立/普通分包、依赖裁剪、共享样式 |
| [Worker 配置](./worker.md) | Worker 入口与构建输出 |
| [生成脚手架配置](./generate.md) | `weapp.generate` 目录结构、后缀与模板定制 |
| [npm 配置](./npm.md) | 自动/手动构建、`weapp.npm` 字段、缓存与优化 |
| [WXML 配置](./wxml.md) | WXML 扫描与模板处理行为 |
| [WXS 配置](./wxs.md) <span class="wv-badge wv-badge--experimental">experimental</span> | WXS 处理与调试建议 |
| [自动导入组件配置](./auto-import-components.md) | `weapp.autoImportComponents` 字段与产物输出 |
| [共享配置](./shared.md) | 自动路由、调试钩子、HMR 与共享 chunk 策略 |
| [Web 运行时配置](./web.md) <span class="wv-badge wv-badge--experimental">experimental</span> | `weapp.web` 浏览器端预览与调试 |

> 仍在寻找 Vite 原生配置？可直接参考 [Vite 官方配置文档](https://cn.vitejs.dev/config/)。

---

如果你不确定从哪里开始，建议先看 **基础目录与资源收集** 和 **构建输出与兼容** 两页。
