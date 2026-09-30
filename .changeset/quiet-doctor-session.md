---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复只读 automator 连接失败时误删持久化会话记录的问题；IDE Doctor 在工具信息读取失败时保留连接成功事实，并确保释放本次连接。
