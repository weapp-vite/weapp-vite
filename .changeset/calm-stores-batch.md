---
'create-weapp-vite': patch
'wevu': patch
---

让 store 的 `$patch` 与 `$reset` 复用响应式 `batch()`，多字段更新只触发一次普通 effect、一次订阅通知和一次宿主 `setData` 调度，并确保 callback 抛错后批处理状态仍能正确恢复。

批处理中同步失效 computed 缓存，禁止运行中的订阅者重新排队，并在外层批处理真正结束后统一发布嵌套 patch 通知；停止后的延迟 effect 不再调用调度器。
