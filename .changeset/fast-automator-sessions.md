---
"@weapp-vite/miniprogram-automator": minor
"@weapp-vite/devtools-runtime": minor
"weapp-ide-cli": minor
"@weapp-vite/mcp": minor
---

支持按端口或 sessionId 区分多个 DevTools automator 会话，并为自动启动流程增加并发安全的端口租约，避免多个自动化任务同时启动时争抢同一个 websocket 端口。
