---
"@weapp-core/constants": patch
"@weapp-vite/mcp": patch
"@weapp-vite/miniprogram-automator": patch
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

将 MCP 默认配置统一到共享常量，并延迟加载 MCP 服务与开发者工具自动化运行时，避免普通构建和禁用 MCP 的配置解析提前加载可选功能；保留现有公开导出及同步配置 API，自动化操作的总超时预算仍包含延迟初始化。
