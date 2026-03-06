---
"wevu": patch
"create-weapp-vite": patch
---

在 `wevu/router` 中新增对齐 Vue Router 心智的基础能力：`useRoute()` 当前路由快照、`resolveRouteLocation()` 路由归一化，以及 `parseQuery()` / `stringifyQuery()` 查询串工具，便于在小程序环境中统一路由解析与类型约束。
