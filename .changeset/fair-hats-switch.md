---
"wevu": patch
"create-weapp-vite": patch
---

移除 `wevu/router` 中未发布的兼容别名 `useRouterNavigation`（以及 `UseRouterNavigationOptions`），将高阶导航入口统一收敛为 `useRouter()`，避免命名分叉带来的使用误解。
