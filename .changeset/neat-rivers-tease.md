---
"weapp-vite": minor
"create-weapp-vite": patch
---

为 `weapp-vite` 增加 MCP 自动启动能力：CLI 原生命令执行时默认自动拉起本地 `streamable-http` MCP 服务（可通过 `weapp.mcp` 配置关闭），并扩展 `weapp-vite mcp` 命令支持 `streamable-http` 启动参数（host/port/endpoint）。
