---
"@weapp-vite/miniprogram-automator": patch
---

修复自动分配 DevTools 自动化端口时的并发会话冲突：启动成功后端口租约会保留到会话关闭或断开，避免多个活跃会话复用同一个自动化端口。
