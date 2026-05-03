---
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/mcp': patch
---

修复 DevTools console 日志启用超时时可能导致常驻 MCP/REST 服务退出的问题，并让 streamable-http MCP 服务使用带会话的 transport，确保标准 MCP client 可以完成初始化和工具发现。
