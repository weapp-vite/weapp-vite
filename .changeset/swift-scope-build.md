---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 scoped build 配置和 CLI 参数，支持通过 `weapp.buildScope` 或 `wv dev/build --scope` 只构建主包与指定分包，并同步裁剪自动路由、typed router、分包声明、preloadRule 与开发态监听范围。
