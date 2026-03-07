---
"@wevu/api": patch
---

继续收紧 `@wevu/api` 的严格兼容策略：移除 `chooseVideo` 在抖音侧映射到 `chooseMedia` 的非等价适配，改为无同等 API 时直接返回 unsupported；同步删除对应无效参数/返回值转换逻辑，更新测试与兼容报告。
