---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `addRoute(parentName, route)` 重载，支持以 Vue Router 心智将子路由动态挂载到已存在父路由下。子路由使用相对路径时会基于父路由路径自动拼接，并保持与 `removeRoute/hasRoute/getRoutes` 的一致行为。
