---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `routes` 兼容入口，用法与 Vue Router 更一致；同时保留 `namedRoutes` 作为兼容写法。初始化时支持同时传入 `routes` 与 `namedRoutes`，并约定同名记录由 `namedRoutes` 覆盖。

另外补齐 `router.options.routes` 快照输出、相关类型测试和文档示例，帮助业务逐步从旧写法迁移到 `routes` 心智。
