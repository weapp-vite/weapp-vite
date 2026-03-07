---
"@wevu/api": patch
---

将 `hideHomeButton` 在支付宝端从 unsupported 调整为严格等价映射到 `my.hideBackHome`，并补齐对应单元测试、类型测试与兼容报告同步。对抖音侧 `getAccountInfoSync -> getEnvInfoSync` 进行了严格证据复核，结论为证据不足，继续保持 unsupported。
