# Web 运行时配置 {#web-config}

`weapp-vite` 可选集成浏览器端运行时（`@weapp-vite/web`），用于 Web 预览/调试。

[[toc]]

## `weapp.web` {#weapp-web}
- **类型**：
  ```ts
  {
    enable?: boolean
    root?: string
    srcDir?: string
    outDir?: string
    pluginOptions?: Partial<WeappWebPluginOptions>
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
        runtime: 'wevu',
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
- `pluginOptions`：透传给 `weappWebPlugin` 的额外参数（`srcDir` 会自动注入）。
- `vite`：额外合并到 Web 构建中的 Vite 内联配置。

> [!NOTE]
> Web 运行时用于预览/调试，不替代开发者工具与真机行为。
