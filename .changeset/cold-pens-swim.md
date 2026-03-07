---
"@wevu/api": patch
---

继续移除 `@wevu/api` 中剩余的 synthetic fallback：`reportAnalytics`（支付宝侧）、`onWindowResize`/`offWindowResize`（支付宝侧）以及 `offMemoryWarning`（抖音侧）在无同等 API 时统一改为 unsupported；同时删除 `createWeapi` 内对应 synthetic 运行时桥接逻辑，保持“仅同等能力可映射，否则直接报错”的策略一致性。
