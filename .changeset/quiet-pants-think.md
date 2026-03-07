---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价首页按钮映射：`hideHomeButton` 在支付宝侧不再映射到 `hideBackHome`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
