---
"@wevu/api": patch
---

继续收紧 `@wevu/api` 的严格兼容策略：移除 `pluginLogin` 在支付宝/抖音侧的异名映射（不再映射到 `getAuthCode/login`），统一改为无同等 API 时返回 unsupported，并同步更新测试、类型注释和兼容报告。
