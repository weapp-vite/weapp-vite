---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 dev 模式下自动路由新增或删除后，依赖 `weapp-vite/auto-routes` 的 app 入口可能继续复用旧虚拟模块内容的问题，避免 Windows 等较慢文件事件环境中出现 app.js 未同步最新路由的 HMR 结果。
