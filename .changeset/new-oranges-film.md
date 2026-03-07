---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价窗口背景映射：`setBackgroundColor` 与 `setBackgroundTextStyle` 在抖音侧不再映射到 `setNavigationBarColor`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
