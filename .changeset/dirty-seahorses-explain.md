---
"@wevu/api": patch
---

继续补齐 `@wevu/api` 的媒体与广告语义映射：新增 `previewMedia`、`createInterstitialAd`、`createRewardedVideoAd`、`createLivePlayerContext`、`createLivePusherContext`、`getVideoInfo` 的支付宝/抖音显式映射与参数对齐（如 `sources.url -> urls`、`src -> filePath`、`adUnitId` 入参规范化）。同时补充单元测试与兼容报告更新，进一步降低 fallback 依赖并提升三端语义对齐覆盖率。
