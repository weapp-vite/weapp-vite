---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价系统设置映射：`getSystemSetting` 与 `getAppAuthorizeSetting` 在抖音侧不再映射到 `getSetting`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
