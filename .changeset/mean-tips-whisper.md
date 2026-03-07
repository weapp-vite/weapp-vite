---
"@wevu/api": patch
---

继续收敛 `@wevu/api` 的严格兼容策略：移除 `previewMedia` 在支付宝/抖音侧映射到 `previewImage` 的非等价适配，统一改为在无同等 API 时返回 unsupported；并删除对应无效参数转换逻辑，同步更新测试和兼容报告。
