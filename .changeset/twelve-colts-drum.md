---
"@wevu/api": patch
---

继续按严格等价策略收敛 `@wevu/api`：移除 `getFuzzyLocation` 在支付宝与抖音侧映射到 `getLocation` 的非等价适配。对于无同等 API 的场景统一返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
