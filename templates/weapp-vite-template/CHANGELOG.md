# weapp-vite-template

## 1.0.6

### Patch Changes

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic

## 1.0.5

### Patch Changes

- 🐛 **为其余原生基础模板补充全原生 `layouts` 能力。相关模板现在统一使用 `src/layouts/*/index.{json,ts,wxml,scss}` 作为布局实现，并提供原生页面版的布局演示页与首页入口，不再混入 Vue 布局文件。** [`3121e45`](https://github.com/weapp-vite/weapp-vite/commit/3121e4545d981e14b08352863134223c5328a757) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic

## 1.0.3

### Patch Changes

- [`9a0fc27`](https://github.com/weapp-vite/weapp-vite/commit/9a0fc27488d46fab165d6bb8a6a75071224921e3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use OIDC for ci publish

## 1.0.2

### Patch Changes

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

## 1.0.1
