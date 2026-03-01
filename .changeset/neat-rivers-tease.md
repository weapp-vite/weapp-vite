---
"weapp-vite": minor
"create-weapp-vite": patch
---

为 `weapp-vite` 增加 MCP 自动启动能力并调整默认策略：新增 `weapp.mcp` 配置，默认不自动拉起 MCP 服务（可通过 `autoStart: true` 开启）；同时扩展 `weapp-vite mcp` 命令支持 `streamable-http` 启动参数（host/port/endpoint）。
