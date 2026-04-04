---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `weapp-vite` CLI 在 `dev` 与 `build` 初始阶段未在终端输出构建耗时的问题。现在小程序首次构建、生产构建，以及 Web 构建或开发服务启动完成后，都会直接打印毫秒级耗时，便于在不启用 analyze UI 的情况下快速判断启动与构建性能。
