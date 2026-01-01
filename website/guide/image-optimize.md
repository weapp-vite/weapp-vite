# 静态资源的处理与优化

`weapp-vite` 在静态资源方面沿用了 Vite 的约定：`import` 语句、`public` 目录、插件生态都可以直接使用。本页总结了新手最常遇到的场景，并给出优化建议。

## 何时放入 `public`

- 放在 `public/` 的文件会原样复制到产物目录（默认同级的 `dist/`），不会参与打包。
- 适合体积较大、无需通过模块系统处理的资源，例如应用图标、`tabbar` 图标、`sitemap.json`。
- 引用方式使用根路径：`/icon.png`、`/static/logo.svg`。对于 `app.json` 中的字段（例如 `tabBar.iconPath`），可按官方要求使用相对或绝对路径。

> [!TIP]
> 可以通过 Vite 的 [`publicDir`](https://cn.vite.dev/config/shared-options#publicdir) 调整目录位置，也可以完全禁用该行为。

## 通过 `import` 引用的资源

当在脚本、样式中使用 `import img from './logo.png'` 或 `background: url('./banner.png')` 时，会由 Rolldown 负责拷贝并生成哈希文件名。这类资源会自动记录在依赖图中，适合页面局部使用的图片。

若需要在运行时根据条件加载，可结合 `new URL('./foo.png', import.meta.url)` 等方式。不过仍建议把静态文件纳入仓库管理，确保构建可重复、可回滚。

## 图片压缩与 CDN

针对图片体积，可从两方面入手：

1. **构建时压缩**：使用 Vite 插件在打包阶段压缩图片。
2. **发布到 CDN/OSS**：将图片上传到静态资源服务，代码中只保留 URL。

### 使用 `vite-plugin-image-optimizer`

该插件会在打包时使用 `sharp`、`svgo` 等工具对图片做无损/有损压缩。示例：

```sh
pnpm add -D vite-plugin-image-optimizer sharp svgo
```

```ts
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      // 按需定制压缩选项，例如：
      png: { quality: 80 },
      jpg: { quality: 80 },
    }),
  ],
})
```

> [!NOTE]
> `sharp` 需要 Node.js 原生依赖，安装失败时可参考插件文档或切换到 `wasm` 方案。

### 与 CDN/OSS 协同

- 在构建脚本中上传资源后，可使用环境变量或配置文件将 URL 注入到页面。
- 保持仓库内仍有源文件，便于回滚与重新构建。
- 若启用自动上传，注意处理好缓存与失效时间，避免小程序端长时间引用旧资源。

## 常见问题

- **开发环境访问不到 `public` 资源？** 请确保以 `/` 开头引用。如果仍然 404，检查资源是否位于 `public/` 根目录而非 `src/public/`。
- **编译后图片路径错乱？** 对于通过 `import` 引入的资源，请避免手动编写相对路径字符串，改用 `import` 或 `new URL`，让构建器接管路径计算。
- **需要自动生成多尺寸图标？** 可以结合 Vite 插件或自定义脚本（如 `sharp`）在构建阶段批量生成。
