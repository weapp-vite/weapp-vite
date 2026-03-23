---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

新增 `weapp.forwardConsole` 开发态日志转发能力：在微信开发者工具连接成功后，可将小程序 `console` 日志与未捕获异常桥接到终端输出。默认在检测到 AI 终端时自动开启，并支持通过配置控制启用状态、日志级别与异常转发行为。
