---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价系统信息映射：`getSystemInfoAsync` 在支付宝与抖音侧不再映射到 `getSystemInfo`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
