---
"wevu": patch
"create-weapp-vite": patch
---

进一步增强 `wevu/router` 的导航管线：新增 `afterEach` 后置钩子（统一获取成功/失败上下文），并支持守卫返回 `{ to, replace }` 形式的重定向结果，让守卫可以显式控制重定向走 `push` 还是 `replace` 语义。
