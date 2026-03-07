---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价小程序跳转映射：`openEmbeddedMiniProgram` 在支付宝与抖音侧不再映射到 `navigateToMiniProgram`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
