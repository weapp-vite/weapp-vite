---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价订阅消息映射：`requestSubscribeDeviceMessage` 与 `requestSubscribeEmployeeMessage` 在支付宝与抖音侧不再映射到 `requestSubscribeMessage`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
