---
"@wevu/api": patch
---

将支付宝端两组严格等价异名能力对齐到微信命名：`createBLEConnection` / `closeBLEConnection` 分别映射到 `my.connectBLEDevice` / `my.disconnectBLEDevice`（并补充 `error|errorCode/errorMessage` 到 `errCode/errMsg` 的结果规范化），`getSystemInfoAsync` 映射到 `my.getSystemInfo`。同步补齐正反向单测、类型测试与兼容报告更新，抖音侧无同等能力的接口仍保持 unsupported。
