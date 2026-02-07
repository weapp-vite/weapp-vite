# @wevu/api

## 0.1.1

### Patch Changes

- 🐛 **feat: 增强支付宝平台高频 API 的微信语义映射。** [`29e5f50`](https://github.com/weapp-vite/weapp-vite/commit/29e5f5034583c97368a1d4e73b128930d6d0f416) by @sonofmagic
  - 在 `alipay` 平台下，新增 `showToast`、`showLoading`、`showActionSheet`、`showModal`、`chooseImage`、`saveFile` 的参数与返回值映射。
  - 保持以微信 API 语义为基底（如 `itemList/tapIndex`、`confirmText/cancelText`、`tempFilePath/tempFilePaths`）。
  - 继续支持剪贴板 API 映射，减少跨平台业务代码分支判断。

## 0.1.0

### Minor Changes

- ✨ **新增跨平台 API 代理，默认导出 `wpi`，支持 Promise 与回调两种调用风格，并兼容多小程序平台。** [`caa9ca5`](https://github.com/weapp-vite/weapp-vite/commit/caa9ca54f2453357a56cf2a433404498bacbd206) by @sonofmagic

### Patch Changes

- 🐛 **完善微信小程序 API 的类型提示与 Promise 风格推导，并补充 tsd 类型测试覆盖。** [`a70029a`](https://github.com/weapp-vite/weapp-vite/commit/a70029a72d7e60b715faee5b4601591b012b4b43) by @sonofmagic

## 0.0.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
