---
'weapp-ide-cli': patch
---

让自动化 CLI 命令优先复用本地 DevTools runtime REST 服务，从而与 MCP、REST HTTP 共享同一个模拟器连接；服务不可用时仍回退到原有直连模式。
