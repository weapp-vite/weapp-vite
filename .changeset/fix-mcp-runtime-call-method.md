---
"@weapp-vite/mcp": patch
---

修复 MCP runtime 工具调用页面和组件方法时未通过小程序 automator `callMethod` 桥接的问题，并补充真实微信开发者工具里的 MCP runtime/devtools 工具成功路径覆盖，确保登录连接、截图、DOM 查询与交互能力可被端到端验证。
