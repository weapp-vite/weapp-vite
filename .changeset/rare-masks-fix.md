---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

在 `weapp-ide-cli` 底层新增按 `projectPath` 复用的共享 automator 会话能力，并将 `weapp-vite dev` 的截图热键切换为通过该共享会话执行。这样后续更多 DevTools 操作都可以基于底层统一的会话复用机制扩展，而不是继续在上层命令里各自维护连接状态。
