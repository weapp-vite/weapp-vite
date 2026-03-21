---
title: Web 运行时配置 experimental
description: weapp-vite 可选集成浏览器端运行时 @weapp-vite/web，用于 H5 预览、兼容验证与开发期调试。
keywords:
  - 配置
  - 运行时
  - config
  - web
  - 运行时配置
  - experimental
  - Weapp-vite
---

# Web 运行时配置 <span class="wv-badge wv-badge--experimental">experimental</span> {#web-config}

`weapp-vite` 可选集成浏览器端运行时（`@weapp-vite/web`），用于 Web 预览、兼容验证与调试。

[[toc]]

> [!TIP]
> Web 端能力边界请配合阅读：[Web 兼容矩阵](/guide/web-compat-matrix)。

> [!WARNING]
> `weapp.web` 仍处于实验阶段（experimental）。当前建议用于开发期预览与调试，不建议作为生产验收的唯一依据。
> 若需查看 Web 侧配置解析结果，可执行 `weapp-vite analyze --platform h5 --json`（当前仅静态分析，非包体分析）。

## 什么时候应该开启

- 想在浏览器里快速查看页面结构、样式与交互，不想每次都切回开发者工具
- 想调试模板转换、运行时表达式或组件映射在 Web 侧的表现
- 想结合浏览器调试工具先定位问题，再回到小程序真机做最终确认

不建议把它理解成“小程序生产等价运行时”。它更像是当前工具链提供的一层 Web 预览与调试支架。

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
- **默认值**：不开启（未配置 `weapp.web` 时不生效）。

### 示例

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
        server: { host: true },
      },
    },
  },
})
```

字段说明：
- `enable`：默认启用（当 `weapp.web` 存在且 `enable !== false` 时生效）。
- `root`：Web 项目根目录（`index.html` 所在目录），默认项目根目录。
- `srcDir`：小程序源码目录（相对于 `root`），默认与 `weapp.srcRoot` 保持一致。
- `outDir`：Web 构建输出目录（相对 `root`），默认 `dist/web`。
- `pluginOptions`：透传给 `weappWebPlugin` 的额外参数。当前可用字段主要包括：
  - `wxss`：WXSS 转换参数（如 `designWidth`、`rpxVar`）。
  - `form`：Web 端表单行为配置（如 `preventDefault`）。
  - `runtime.executionMode`：运行时执行策略（`compat`/`safe`/`strict`）：
    - `compat`（默认）：保持历史行为。
    - `safe`：表达式与 WXS 错误降级为告警并返回空值。
    - `strict`：表达式与 WXS 错误直接抛出，便于开发期快速定位。
  - `runtime.warnings`：运行时告警策略：
    - `level`：`warn`（默认）/`error`/`off`，分别对应 `console.warn`、`console.error`、关闭告警输出。
    - `dedupe`：默认 `true`，同一告警 key 仅输出一次。
  - `srcDir` 由 `weapp.web.srcDir` 自动注入，此处无需手动传入。
- `vite`：额外合并到 Web 构建中的 Vite 内联配置。

> [!NOTE]
> Web 运行时用于预览/调试，不替代开发者工具与真机行为。
