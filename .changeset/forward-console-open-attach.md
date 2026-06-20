---
"weapp-vite": patch
"create-weapp-vite": patch
"weapp-ide-cli": patch
"@weapp-vite/devtools-runtime": patch
---

修复 `wv dev -o` 打开微信开发者工具后没有稳定接入 `forwardConsole` 的问题，避免日志桥接在自动化会话未就绪时二次拉起开发者工具，并优化小程序日志的终端颜色展示。
