---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价分享能力映射：`showShareImageMenu`、`updateShareMenu` 在支付宝/抖音侧不再映射到 `showSharePanel`/`showShareMenu`，统一改为在无同等 API 时返回 unsupported。同步更新测试、类型注释与兼容报告。
