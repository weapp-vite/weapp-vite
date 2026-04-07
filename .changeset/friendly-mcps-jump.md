---
'create-weapp-vite': patch
'weapp-vite': patch
---

为 `weapp-vite` MCP 增加面向 Codex、Claude Code 与 Cursor 的接入引导能力，支持通过 `wv mcp init`、`wv mcp print`、`wv mcp doctor` 预览、写入和检查客户端配置；同时在 dev/MCP HTTP 服务启动后直接输出可执行的接入命令，降低首次使用门槛。
