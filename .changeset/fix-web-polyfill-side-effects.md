---
'@weapp-vite/web': patch
---

修复 Web 生产构建错误移除运行时 polyfill 全局安装副作用的问题，确保 `wx`、`getApp` 和 `getCurrentPages` 在生产包中可用。
