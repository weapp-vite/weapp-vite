---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 workspace HMR 审计以仓库根目录启动项目导致监听和构建上下文过大的问题，并收窄独立分包 watcher 对主包页面更新的误处理，降低开发态 HMR 报告中的误触发和异常耗时。
