---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复 ESM shared chunk 中 request runtime 安装代码覆盖第三方库同名局部变量的问题，并稳定微信开发者工具打开后的项目索引刷新流程。现在 request globals 共享安装阶段只同步运行时 actuals 与 `globalThis`，避免把 `Request`、`WebSocket` 等 Web API 绑定回写到 chunk 内部变量；同时 `wv open` / `wv dev --open` 会在打开后刷新项目、重置 fileutils 并在 HTTP engine build 端点缺失时回退到官方 CLI，减少模拟器首次启动时读取陈旧配置导致的 `subPackages` 异常。
