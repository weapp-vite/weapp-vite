---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `wv open` 默认通过微信开发者工具 automator 临时包装项目打开的问题，确保 `wv open` 与 `wv dev -o` 都打开真实小程序项目目录，并仅在打开后为截图、MCP 等联动命令准备真实项目根的 automator 会话。
