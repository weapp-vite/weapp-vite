---
"@wevu/api": patch
---

feat: 增强支付宝平台高频 API 的微信语义映射。

- 在 `alipay` 平台下，新增 `showToast`、`showLoading`、`showActionSheet`、`showModal`、`chooseImage`、`saveFile` 的参数与返回值映射。
- 保持以微信 API 语义为基底（如 `itemList/tapIndex`、`confirmText/cancelText`、`tempFilePath/tempFilePaths`）。
- 继续支持剪贴板 API 映射，减少跨平台业务代码分支判断。
