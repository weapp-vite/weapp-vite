# Web 运行时配置 {#web-config}

`weapp-vite` 可选集成浏览器端运行时（基于 `@weapp-vite/web`），用于在 Web 中预览或调试小程序逻辑与页面结构。

[[toc]]

## `weapp.web` {#weapp-web}
- **类型**：
  ```ts
  {
    enable?: boolean
    root?: string
    srcDir?: string
    outDir?: string
    pluginOptions?: Record<string, any>
    vite?: InlineConfig
  }
  ```
- **默认值**：`{ enable: false }`

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    web: {
      enable: true,
      root: '.',
      srcDir: 'src',
      outDir: 'dist-web',
      pluginOptions: {
        // 透传给 @weapp-vite/web 插件的参数
      },
      vite: {
        define: {
          __WEB_PREVIEW__: JSON.stringify(true),
        },
      },
    },
  },
})
```

字段说明：

- `enable`: 是否启用 Web 运行时集成。
- `root`: Web 侧项目根目录（`index.html` 所在目录）；默认项目根目录。
- `srcDir`: 小程序源码目录（相对于 `root`）；默认与 `weapp.srcRoot` 一致。
- `outDir`: Web 构建产物输出目录（相对 `root`），默认 `dist-web`。
- `pluginOptions`: 传给 `weappWebPlugin` 的额外参数（不包含 `srcDir`）。
- `vite`: 额外合并到 Web 构建中的 Vite 内联配置。

> [!NOTE]
> Web 运行时主要用于预览与调试，并不替代小程序真机/开发者工具的实际行为。
