---
"@weapp-vite/miniprogram-automator": patch
"@weapp-vite/mcp": patch
"weapp-ide-cli": patch
---

增强 DevTools 截图链路的超时与可恢复失败重试能力，避免 IDE 自动化、MCP runtime 截图和 `weapp-ide-cli screenshot` 在 `App.captureScreenshot` 暂时无响应或返回截图失败时直接中断。
