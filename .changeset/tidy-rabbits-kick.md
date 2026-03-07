---
'@wevu/api': patch
---

新增 `createRewardedVideoAd(wx)` 到 `createRewardedAd(my)` 的严格等价映射：创建参数自动提取 `adUnitId`，并对返回广告实例的 `load/show/destroy` 自动注入 `adUnitId` 以兼容微信调用方式。同时对 `multiton`、`disableFallbackSharePage` 等支付宝无等价能力参数在运行时按不支持报错，并补充对应单元测试。
