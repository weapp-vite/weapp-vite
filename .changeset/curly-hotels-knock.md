---
"@wevu/api": patch
---

继续推进 `weapi` 三端语义对齐，补充 `batchSetStorage`、`batchGetStorage`、`batchSetStorageSync`、`batchGetStorageSync`、`createCameraContext`、`offMemoryWarning`、`cancelIdleCallback` 的显式映射与 synthetic 运行时兼容；同步新增对应单测并更新类型文档与兼容性报告，进一步降低 fallback 数量并提升三端语义对齐率。
