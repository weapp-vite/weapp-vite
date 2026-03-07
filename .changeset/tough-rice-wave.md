---
"wevu": patch
"create-weapp-vite": patch
---

增强 `wevu/router` 的路由配置可观测性与重名处理语义：初始化时若 `routes` 与 `namedRoutes`（或同一来源）存在同名路由，会输出告警并明确“后者覆盖前者”。

同时调整 `addRoute()` 的重名行为：新增同名路由时会先清理旧路由及其 `children` 链，再写入新记录，避免旧路径/旧子路由残留造成匹配歧义。并补充覆盖守卫、重定向、静态路径索引和 children 清理的回归测试与文档说明。
