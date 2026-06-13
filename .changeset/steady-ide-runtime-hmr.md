---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
"@weapp-vite/miniprogram-automator": patch
---

修复 wevu 页面布局、作用域插槽和无脚本组件在真实小程序运行时中的输出稳定性，并增强 DevTools 自动化连接、截图和 HMR fixture 的清理与恢复，避免 IDE 全量回归受残留会话或脏 fixture 状态影响。
