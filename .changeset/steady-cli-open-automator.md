---
"weapp-vite": patch
"create-weapp-vite": patch
"weapp-ide-cli": patch
---

修复 `dev -o` 通过官方 CLI 打开项目后未启动项目稳定 automator 端口，以及 automator 启动耗尽超时预算后重复等待的问题，确保控制台转发、截图、MCP 与 IDE 自动化能够及时恢复并连接当前项目，同时保留打开前仅复用已有会话的行为。
