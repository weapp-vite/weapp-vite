---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复多个模板或项目同时/顺序运行 `weapp-vite dev -o` 时，微信开发者工具 automator 默认端口可能复用旧项目窗口的问题。`dev:open` 现在会为每个真实项目派生稳定的 automator 端口，并将截图、MCP 与会话重建路径绑定到对应项目，避免热更新、截图或 MCP 误连到其它模板。
