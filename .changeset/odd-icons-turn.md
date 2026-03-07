---
"@wevu/api": patch
---

继续清理 `@wevu/api` 的非等价映射：移除支付宝侧 `createLivePlayerContext`、`createLivePusherContext` 到 `createVideoContext` 的兼容映射，改为在无同等 API 时直接返回 unsupported；并同步更新单元测试、类型注释与兼容报告。
