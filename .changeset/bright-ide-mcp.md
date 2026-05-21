---
"@weapp-vite/devtools-runtime": minor
"@weapp-vite/mcp": patch
"weapp-ide-cli": minor
---

新增 `weapp mcp` 标准 MCP 入口，让 AI 客户端可以直接连接微信开发者工具 automator 会话，并调用页面读取、元素查询、点击输入、截图与基础宿主 API 工具完成小程序模拟器里的 E2E 验证。

同时将 DevTools MCP 的路径解析、结构化输出序列化和元素快照读取抽到 `@weapp-vite/devtools-runtime` 公共模块，供 `@weapp-vite/mcp` 与 `weapp-ide-cli` 复用，避免两套 MCP 入口重复维护基础运行时契约。
