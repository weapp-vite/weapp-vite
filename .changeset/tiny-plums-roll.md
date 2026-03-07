---
"@wevu/api": patch
---

继续按严格对齐策略清理 `@wevu/api`：移除 `createVKSession`、`batchSetStorage`、`batchGetStorage`、`batchSetStorageSync`、`batchGetStorageSync`、`createCameraContext`、`cancelIdleCallback`、`nextTick`、`getLogManager` 在支付宝/抖音端的 synthetic 兜底支持。对于无同等 API 的平台统一返回 unsupported，并同步更新单元测试、类型文档注释与兼容报告。
