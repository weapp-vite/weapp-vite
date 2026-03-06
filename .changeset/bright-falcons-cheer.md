---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 增加 `onError()` 订阅能力，用于集中处理路由守卫抛错等异常型导航失败；同时保留 `afterEach` 对所有导航结果的统一收敛，减少 duplicated/cancel 等预期失败对异常监控的干扰。
