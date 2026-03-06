---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 增加 `RouteRecordRaw` 子集能力（`meta`、`beforeEnter`、`redirect`），并将 `namedRoutes`、`getRoutes()`、`addRoute()` 升级到记录模型；导航流程新增路由记录级重定向与 `beforeEnter` 守卫执行，`resolve()` 可从命中记录注入 `meta`，进一步对齐 Vue Router 的路由心智模型。
