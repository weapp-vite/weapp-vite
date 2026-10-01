---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复 IDE 打开、重连和截图恢复可能关闭其他项目的问题：恢复只重试目标连接，保留现有宿主；显式关闭失败时返回失败，不再通过应用退出或进程匹配扩大清理范围。
