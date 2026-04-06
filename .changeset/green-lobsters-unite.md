---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite dev` 在初次构建完成后开发态快捷键可能失效的问题。现在会在开发服务就绪时重新接管终端输入，恢复 `h` 帮助、`s` 截图、`m` 开关 MCP 与 `q` 退出等热键响应，避免构建过程临时改写终端状态后导致快捷键无效。
