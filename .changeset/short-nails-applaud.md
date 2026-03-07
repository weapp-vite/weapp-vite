---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价账号信息映射：`getAppBaseInfo` 与 `getAccountInfoSync` 在抖音侧不再映射到 `getEnvInfoSync`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
