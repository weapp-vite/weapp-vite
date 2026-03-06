---
"@wevu/api": patch
---

继续补齐 `@wevu/api` 的高频跨端同义 API 映射，新增 20 组微信命名到支付宝/抖音目标 API 的对齐规则（如 `pluginLogin` -> `my.getAuthCode` / `tt.login`、`openEmbeddedMiniProgram` -> `navigateToMiniProgram`）。同时补充对应单元测试、类型文档矩阵与兼容报告生成产物，提升按微信命名调用时的三端覆盖率与一致性。
