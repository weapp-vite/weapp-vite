---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `wv dev -o` 打开微信开发者工具后没有继续接入 `forwardConsole` 的问题，确保页面点击触发的 `console` 日志也能转发到命令行。
