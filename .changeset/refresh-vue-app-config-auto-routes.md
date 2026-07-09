---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC `defineAppJson` 依赖 auto-routes 时入口收集可能复用旧配置的问题，确保自定义 tabbar、app-bar 等由最终 `app.json` 引用的应用级组件会同步进入构建产物。
