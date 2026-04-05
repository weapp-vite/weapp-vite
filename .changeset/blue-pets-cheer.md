---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` App 全局事件在微信开发者工具中可能重复注册的问题，避免 `onError`、`onPageNotFound`、`onUnhandledRejection` 与 `onThemeChange` 在 `github-issues` 等 IDE 运行时场景下触发大量 listener 泄漏告警；同时清理 `issue-320` 复现页的路由初始化噪音，保持 IDE warning 报告聚焦真实异常。
