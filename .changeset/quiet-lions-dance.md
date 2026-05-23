---
"@weapp-vite/miniprogram-automator": patch
---

修复 DevTools 在 `App.getCurrentPage` 持续超时后无法回退到 `App.getPageStack` 的问题，避免 IDE 运行时在路由切换和当前页面读取阶段卡死。该修复直接提升了 issue #597、#599、#600 这类依赖 IDE 运行结果的稳定性。
