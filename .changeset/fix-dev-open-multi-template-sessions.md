---
"weapp-vite": patch
"weapp-ide-cli": patch
"@weapp-vite/mcp": patch
"@weapp-vite/devtools-runtime": patch
"create-weapp-vite": patch
---

修复多个 TailwindCSS 模板同时执行 `pnpm dev:open` 时，截图、MCP 与其他微信开发者工具联动可能连接到默认全局 automator 端口或其他项目窗口的问题。开发态普通 open 后会为真实项目根目录准备独立的默认 automator 会话，MCP runtime 默认保留真实项目根目录，确保多开场景下各模板的热更新、截图和运行时调试都绑定到自己的项目。
