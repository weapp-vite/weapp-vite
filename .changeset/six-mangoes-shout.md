---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价地址能力映射：`chooseAddress` 在支付宝侧不再映射到 `getAddress`，统一改为在无同等 API 时返回 unsupported，并同步更新单元测试、类型注释和兼容报告。
