---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价支付能力映射：`requestPayment`、`requestOrderPayment`、`requestPluginPayment`、`requestVirtualPayment` 在支付宝与抖音侧不再映射到 `tradePay/pay`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
