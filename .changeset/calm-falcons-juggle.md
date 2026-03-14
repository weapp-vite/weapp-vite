---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `autoRoutes` 在生产构建中的两个问题：普通 `build` 模式下不再错误注册 watch 目标，避免构建结束后进程无法退出；同时修复 `app.vue` 中通过 `defineAppJson` 引用 `weapp-vite/auto-routes` 时的递归解析问题，避免包含自动路由的项目在构建阶段卡死。
