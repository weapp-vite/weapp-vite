---
"create-weapp-vite": patch
"wevu": patch
---

修复返回导航与 Vue Router 守卫语义不一致的问题；`router.back()` 现在会从页面栈解析目标路由，原生返回和系统返回也会触发 `beforeEach`、`beforeResolve` 与 `afterEach`，并向 hooks 提供完整的 `to` 和 `from`。
