---
"weapp-vite": patch
---

修复开发模式 HMR 后 `wevu/router` 等 wevu 子入口可能残留为裸包导入的问题，避免微信开发者工具重新加载入口时出现模块未定义错误。
