---
"wevu": patch
"create-weapp-vite": patch
---

调整 `wevu/router` 的命名心智：将高阶导航入口统一为 `useRouter()`，并新增 `useNativeRouter()` / `useNativePageRouter()` 表达原生路由桥接语义；同时保留 `useRouterNavigation()` 作为兼容别名，便于渐进迁移。
