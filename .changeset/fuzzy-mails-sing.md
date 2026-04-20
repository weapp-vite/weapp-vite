---
'@wevu/api': patch
---

修复 `@wevu/api` 在 promisify 类型映射中把“末尾 `option` 对象没有任何必填字段”的宿主 API 仍然推断为必须传参的问题。现在像 `wpi.scanCode()`、`wpi.getSetting()`、`wpi.stopPullDownRefresh()` 这类本来允许零参调用的 API，会正确暴露零参 Promise 签名；同时新增基于 TypeScript API 的守卫脚本，自动校验微信 typings 中所有 `option` 全可选的方法都被 `weapi` 正确映射为可零参调用，避免后续回归。
