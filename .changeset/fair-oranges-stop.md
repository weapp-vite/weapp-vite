---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价认证能力映射：`login`、`authorize`、`checkSession` 在支付宝侧不再映射到 `getAuthCode`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
