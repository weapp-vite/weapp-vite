---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复 `wv open` 默认通过微信开发者工具 automator 临时包装项目打开的问题，并避免 `wv open` / `wv dev -o` 在官方 CLI 打开项目成功后继续通过 DevTools HTTP `/open` 二次打开项目。同时会从官方 CLI 本次输出中捕获真实服务端口，避免后续 fileutils 与 engine build 刷新误连旧端口。
