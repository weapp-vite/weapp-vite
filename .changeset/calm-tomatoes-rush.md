---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `weapp.mcp.autoStart` 的自动启动日志补充了接近 Vite 风格的地址输出（`➜ URL`），便于在终端快速识别 MCP 服务入口；同时新增 `apps/mcp-demo` 的自动启动配置，使执行 `pnpm dev` 时可自动拉起 `http://127.0.0.1:3188/mcp`。
