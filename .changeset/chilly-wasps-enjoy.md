---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `RouteRecordRaw.children` 声明支持。现在可以在 `namedRoutes` 中使用树状路由配置，运行时会自动展平成可匹配记录，并支持子路由的 `resolve`、路径反查（`name/params` 推断）以及 `beforeEnter/redirect` 执行链路。同时，`children` 命中场景下 `resolve().matched` 会返回父到子的匹配链，`resolve().meta` 按父到子顺序进行浅合并，更贴近 Vue Router 心智模型。
