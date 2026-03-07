---
"@wevu/api": patch
---

继续收紧 `@wevu/api` 的跨端映射：移除 `createInterstitialAd` 在支付宝侧的非等价映射（不再映射到 `createRewardedAd`），以及移除 `createLivePusherContext` 在抖音侧的非等价映射（不再映射到 `createVideoContext`）。同时保留同名直连能力，仅在宿主缺失同等 API 时返回 unsupported，并同步更新测试与兼容报告。
