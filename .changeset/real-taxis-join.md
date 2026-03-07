---
"@wevu/api": patch
---

将 `createBLEConnection` / `closeBLEConnection` 在支付宝端升级为严格等价异名映射：分别对齐到 `my.connectBLEDevice` / `my.disconnectBLEDevice`，并补充 `error|errorCode/errorMessage` 到微信风格 `errCode/errMsg` 的结果规范化。同步新增正反向单测与严格策略计划文档，抖音侧仍保持 unsupported。
