---
"wevu": patch
"create-weapp-vite": patch
---

继续增强 `wevu/router`：新增 `beforeResolve` 守卫，并支持守卫返回重定向目标（字符串或路由对象）；同时为重定向链路加入 `maxRedirects` 上限控制，避免守卫循环重定向导致的无限导航。
