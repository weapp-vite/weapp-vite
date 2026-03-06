---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 增加运行时路由管理能力：新增 `addRoute()` 与 `removeRoute()`，并与 `hasRoute()/getRoutes()`、命名路由解析链路联动，使 `namedRoutes` 支持在运行时动态增删并立即生效。
