# @weapp-vite/web

## 1.1.0

### Minor Changes

- ✨ **Web 运行时 weapp-button 样式对齐小程序默认按钮，并支持通过 adoptedStyleSheets 复用样式，降低 ShadowRoot 注入成本。** [`f7810a7`](https://github.com/weapp-vite/weapp-vite/commit/f7810a7ff4647307824bd8f4fd8a2fab0c7fa716) by @sonofmagic

- ✨ **新增 Web 模式的 --host CLI 参数，并增强 Web 编译期组件标签映射与属性绑定，提升 H5 运行时的交互兼容性。** [`f38965c`](https://github.com/weapp-vite/weapp-vite/commit/f38965c654802dfb5a415d7f85e88c079bdb85b9) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **Web 端 HMR 支持保留页面状态，模板/样式/逻辑更新不触发全量刷新。** [`dd2b69d`](https://github.com/weapp-vite/weapp-vite/commit/dd2b69d81b8b0aa530654b349be304c6081b8500) by @sonofmagic

- 🐛 **Web 端新增导航栏对齐能力：构建期注入 `weapp-navigation-bar`，并补齐 `wx.setNavigationBarTitle/setNavigationBarColor/showNavigationBarLoading/hideNavigationBarLoading` 等 API 以支持安全区与样式更新。** [`6e1c9c7`](https://github.com/weapp-vite/weapp-vite/commit/6e1c9c71ce0c861ec35be4028b78992b8769c059) by @sonofmagic

## 1.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 0.0.3

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.2

### Patch Changes

- [`252b807`](https://github.com/weapp-vite/weapp-vite/commit/252b80772508ef57a0dc533febddc1a1e69aa4c2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 autoImportComponents.htmlCustomData 选项，支持在 VS Code 等编辑器中生成小程序组件的 HTML Custom Data；同时扩展 H5 运行时对多种模板后缀的识别能力，使 `.html` 等模板与小程序组件共用自动导入机制。
