---
"weapp-vite": patch
"@weapp-vite/dashboard": patch
"create-weapp-vite": patch
---

将 DevTools 工作台的直接依赖 Devframe 从 1.0.0 升级至 1.1.0，并同步模板依赖目录。核对上游更新后保留现有 scoped RPC、OTP/Origin 鉴权和断线重连写法，继续关闭 bridge 的 MCP，不强制覆盖 `@vitejs/devtools-kit` 的传递 Devframe/Hub 0.8 依赖。
