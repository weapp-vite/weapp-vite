---
"wevu": patch
"create-weapp-vite": patch
---

在 `wevu/router` 中补充 Vue Router 风格的导航封装能力：新增 `useRouterNavigation()`（`push/replace/back/resolve`）、`NavigationFailureType`、`createNavigationFailure()` 与 `isNavigationFailure()`，用于统一处理小程序路由调用结果与失败分类。
