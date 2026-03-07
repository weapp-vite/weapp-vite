---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价音频上下文映射：`createAudioContext`、`createWebAudioContext` 在支付宝/抖音侧不再映射到 `createInnerAudioContext`，统一改为无同等 API 时返回 unsupported，并同步更新测试、类型注释和兼容报告。
