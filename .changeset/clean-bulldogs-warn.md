---
'@weapp-vite/dashboard': patch
---

增强 dashboard 的运行事件链路健壮性，统一规范化无效或不完整的事件载荷，并补充事件耗时与元信息展示。同时为 `packages/dashboard` 增加独立的 Vitest 配置，使相关工具测试可以进入工作区测试链路。
