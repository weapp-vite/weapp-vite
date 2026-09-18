---
"weapp-vite": patch
"create-weapp-vite": patch
---

使 `build.emptyOutDir: false` 同时约束框架启动清理、完整重建和独立插件构建，避免 IDE 持续打开时主包与插件产物被提前删除；保留默认清理行为及开发启动专用配置。
