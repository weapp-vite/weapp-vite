---
"weapp-vite": patch
"create-weapp-vite": patch
"weapp-ide-cli": patch
---

仅在启用且安装 Dashboard 后加载其服务器与 MCP 传输依赖，并将 IDE MCP SDK 的加载推迟到实际创建服务时，避免普通 CLI 帮助和构建命令提前加载未使用的服务。
