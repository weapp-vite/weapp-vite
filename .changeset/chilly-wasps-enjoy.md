---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `RouteRecordRaw.children` 声明支持。现在可以在 `namedRoutes` 中使用树状路由配置，运行时会自动展平成可匹配记录，并支持子路由的 `resolve`、路径反查（`name/params` 推断）以及 `beforeEnter/redirect` 执行链路。
