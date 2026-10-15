---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复使用 Bun 运行 `wv dev` 时因误判 IPC 已断开而静默退出的问题，保留真实父进程断开后的资源清理行为。
