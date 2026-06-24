---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态长截图在复杂页面上依赖 `Page.getWindowProperties` 容易超时的问题，并让 `wv dev -o` 的 `s` 截图热键保持默认整页长截图，同时避免截图期间的日志桥 automator 会话干扰截图协议。
