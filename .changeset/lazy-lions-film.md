---
"wevu": patch
"create-weapp-vite": patch
---

收敛 `wevu/router` 的 `router.options` 语义：现在会返回运行时冻结的初始化快照，避免业务侧误改配置导致的状态歧义。快照保持“初始化值”定位，不随 `addRoute/removeRoute/clearRoutes` 动态变化；动态路由状态请通过 `getRoutes()` 获取。

同时补充对应回归测试与文档说明，明确 `routes` 为推荐入口、`namedRoutes` 为兼容入口的迁移策略。
