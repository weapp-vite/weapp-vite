---
'@wevu/api': patch
'create-weapp-vite': patch
---

修复 `@wevu/api` 对非 Promise 化小程序 API 的类型推断，避免同步句柄与上下文能力被错误包装为异步返回；同时继续清理零售模板中的页面、服务与组件类型问题，收敛到可通过类型检查的状态。由于模板内容会随 `create-weapp-vite` 一起分发，因此同步补一个补丁版本。
