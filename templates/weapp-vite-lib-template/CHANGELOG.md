# weapp-vite-lib-template

## 2.0.2

### Patch Changes

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic
- 📦 **Dependencies** [`aef4a30`](https://github.com/weapp-vite/weapp-vite/commit/aef4a30c974c566dc181cc7152e04c96d0f6e41e)
  → `wevu@6.11.2`

## 2.0.1

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.11.1`

## 2.0.0

### Patch Changes

- 🐛 **为原生 `Page()` 页面补充 layout 运行时切换能力，并将 `setPageLayout` 从 `weapp-vite` 直接导出。`weapp-vite-lib-template` 现在也内置 `src/layouts` 与原生布局演示页，可在不使用 wevu 页面写法的前提下体验 default/admin/关闭布局三种模式。** [`072998a`](https://github.com/weapp-vite/weapp-vite/commit/072998acfe2a913fb2ecae2702cd3c0c0db4a8b9) by @sonofmagic
- 📦 **Dependencies** [`35a6ee0`](https://github.com/weapp-vite/weapp-vite/commit/35a6ee06d7b8fa56435684011cc706ea5bf9f432)
  → `wevu@6.11.0`

## 1.0.1

### Patch Changes

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic

## 1.0.0

### Patch Changes

- Initial release
