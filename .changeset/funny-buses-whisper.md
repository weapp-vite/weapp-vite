---
"wevu": patch
"create-weapp-vite": patch
---

增强 `usePageScrollThrottle()`：新增 `maxWait` 选项，在持续滚动期间可限制“最长不触发时间”，避免仅依赖 `interval`/`trailing` 时长时间未回调。

同时补充 `maxWait` 相关边界测试与类型覆盖，确保 `leading`、`trailing`、`maxWait` 组合行为稳定，并保持卸载时定时器清理语义不变。
