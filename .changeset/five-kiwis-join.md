---
"@wevu/api": patch
---

继续增强 `weapi` 三端兼容层：新增 `nextTick`、`getLogManager`、`reportAnalytics`、`onWindowResize`、`offWindowResize` 的内置 synthetic 对齐能力，补齐 `getFuzzyLocation` 映射，并为抖音 `showActionSheet` 增加 `showModal` 降级 shim。同步更新单元测试、类型文档与兼容性报告，使三端可调用完全对齐达到 100%。
