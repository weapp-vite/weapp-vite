---
"@wevu/api": patch
---

继续推进 `@wevu/api` 语义映射批次：新增 `authorize`、`checkSession`、`requestPayment`、`requestOrderPayment`、`requestPluginPayment`、`requestVirtualPayment` 的支付宝/抖音显式映射与参数对齐（含 `scope -> scopes`、`package -> orderStr/orderInfo`）。同时补充单元测试并更新兼容报告，降低 fallback 依赖，提升三端语义对齐覆盖率。
