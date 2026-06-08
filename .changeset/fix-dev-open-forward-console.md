---
"weapp-vite": patch
---

修复 `dev --open` 在 `forwardConsole` 已连接时跳过微信开发者工具打开与项目刷新流程的问题。现在启动阶段会强制执行 IDE 打开、fileutils 重置和编译刷新，避免小程序产物已经重新构建但开发者工具不响应文件变化。
