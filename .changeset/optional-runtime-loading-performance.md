---
'@weapp-core/constants': patch
'@weapp-vite/mcp': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/tailwindcss': patch
'create-weapp-vite': patch
'weapp-ide-cli': patch
'weapp-vite': patch
---

perf(runtime): 按实际启用能力延迟加载可选插件与 Node 运行时，降低普通 CLI 和小程序构建的启动开销。

- 仅在实际启用时加载 Web、Tailwind、高级路径、Dashboard、MCP 与 automator 依赖；保留同步配置 API、公开导出和包含延迟初始化的总超时预算，MCP 默认配置统一到共享常量。
