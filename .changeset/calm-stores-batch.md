---
'create-weapp-vite': patch
'wevu': patch
---

让 store 的 `$patch` 与 `$reset` 复用响应式 `batch()`，多字段更新只触发一次普通 effect、一次订阅通知和一次宿主 `setData` 调度，并确保 callback 抛错后批处理状态仍能正确恢复。
