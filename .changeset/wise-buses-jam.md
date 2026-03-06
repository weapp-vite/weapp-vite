---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 新增 `hasRoute(name)` 与 `getRoutes()`，用于在运行时检查和读取 `namedRoutes` 映射；同时补齐命名路由在守卫重定向场景下的测试覆盖，确保 `{ name, params }` 目标可被一致解析并导航。
