---
"@weapp-vite/miniprogram-automator": patch
---

修复微信开发者工具返回异常 XPath 集合响应时泄漏无上下文 `map` 错误的问题，改为报告明确的协议方法与缺失字段，便于 MCP runtime tools 和自动化调用定位兼容性限制。
