---
'@weapp-vite/web': patch
---

修复 Web 运行时在生产构建 tree-shaking 后丢失 `wx`、`getApp` 和 `getCurrentPages` 全局安装的问题。
