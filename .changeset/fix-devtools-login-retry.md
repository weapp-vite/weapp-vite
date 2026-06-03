---
"weapp-vite": patch
"weapp-ide-cli": patch
---

修复微信开发者工具登录失效后 open 流程可能重复提示登录重试的问题，并让截图与 MCP/DOM 自动化连接在登录恢复后复用同一套重试流程。
