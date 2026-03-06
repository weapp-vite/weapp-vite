---
"wevu": patch
"create-weapp-vite": patch
---

增强 `wevu/router` 的导航能力：`useRouterNavigation()` 新增 `beforeEach` 轻量守卫，并支持按 `tabBarEntries` 自动把 `push/replace` 分流到 `switchTab`，同时补充对应的失败判定与类型约束。
