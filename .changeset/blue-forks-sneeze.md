---
"@wevu/api": patch
---

继续补齐 `@wevu/api` 第二批高频 API 对齐：新增 `login`、`chooseVideo`、`hideHomeButton`、`getWindowInfo`、`getDeviceInfo`、`getAccountInfoSync` 的跨端映射，并补充参数/返回值语义转换（如 `chooseMedia` 结果对齐为 `chooseVideo` 结构、`getEnvInfoSync` 对齐为账号信息结构）。同时更新单元测试、类型文档矩阵与兼容报告，进一步提升三端按微信命名调用的可用覆盖率。
