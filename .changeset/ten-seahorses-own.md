---
'weapp-vite': patch
'create-weapp-vite': patch
---

调整 npm 构建默认压缩策略：`weapp-vite` 的 npm 打包产物默认不再压缩（`build.minify` 默认值从 `true` 改为 `false`），以便在小程序端更容易排查依赖代码问题。若有体积优化需求，仍可通过 `weapp.npm.buildOptions` 显式覆盖为 `minify: true`。
