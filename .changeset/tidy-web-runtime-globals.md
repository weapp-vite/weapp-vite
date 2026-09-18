---
"@weapp-vite/web": patch
---

由 Web 运行时公开入口显式安装小程序全局 API，避免拆分发布模块经过生产摇树优化后丢失 `wx`、`getApp` 和 `getCurrentPages`，恢复原生与 Wevu 路由导航。
