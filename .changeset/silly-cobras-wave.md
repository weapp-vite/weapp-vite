---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `router.clearRoutes()`，用于一次性清空当前路由器实例中的命名路由记录（包含初始化和运行时动态添加的记录）。该能力与 `addRoute/removeRoute/getRoutes/hasRoute` 形成完整的路由记录管理闭环，便于迁移期重置路由表与测试隔离。
