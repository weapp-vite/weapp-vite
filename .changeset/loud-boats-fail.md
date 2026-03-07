---
"@wevu/api": patch
---

继续按严格对齐策略收敛 `@wevu/api`：移除抖音端 `createRewardedVideoAd -> createInterstitialAd` 与 `saveVideoToPhotosAlbum -> saveImageToPhotosAlbum` 的非等价映射，统一改为 unsupported；同时清理 `methodMapping` 中已失效的 synthetic 支持死代码，避免误判平台可用性。
