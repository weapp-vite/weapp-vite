# weapp-vite 分包最佳实践 Demo

该示例配合 [`docs/subpackages.md`](../../docs/subpackages.md) 展示了如何在一个小程序中落地主包 + 多分包的最佳实践。

## 场景亮点

- **真实的 app.json 规划**：主包仅保留首页，并通过 `preloadRule` 预下载高频分包，启用 `lazyCodeLoading` 与 `theme/sitemap`。
- **分包差异化配置**：`packages/order` 作为独立分包，开启专属 `autoImportComponents`、`dependencies` 和共享样式注入，其余分包沿用主包默认策略。
- **自动组件导入**：主包与分包分别声明 `autoImportComponents.globs`，页面引用 `<HelloWorld>`、`<OrderMetrics>` 时无需手动维护 `usingComponents`。
- **共享 chunk 策略**：在 `vite.config.ts` 中通过 `chunks.sharedStrategy: 'duplicate'` 控制跨分包依赖复制，避免首包拉取大量共享模块。
- **CLI 分析**：可执行 `pnpm --filter subpackage-shared-chunks weapp-vite analyze` 查看各分包产物与共享依赖。

## 常用命令

- `pnpm dev`：启动 weapp-vite 开发构建，监听主包与独立分包。
- `pnpm dev --open`：构建完成后自动打开微信开发者工具（需提前配置 CLI）。
- `pnpm build`：产出可上传的分包构建结果。
- `pnpm open`：仅打开微信开发者工具查看 dist。

## 相关文档

- weapp-vite: https://vite.icebreaker.top/
- 分包指南: https://vite.icebreaker.top/config/subpackages.html
- weapp-tailwindcss: https://tw.icebreaker.top/
