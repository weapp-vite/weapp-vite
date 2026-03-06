---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 新增 `useDisposables()` 组合式清理工具：在 `setup()` 中可统一注册清理函数或带 `dispose/abort/cancel/stop/disconnect/destroy/close` 方法的对象，并在 `onUnload/onDetached` 自动批量释放，支持幂等 `dispose()` 与取消注册。

同时提供 `bag.setTimeout()` / `bag.setInterval()` 计时器辅助，自动在销毁时清理 timer，减少页面与组件长期运行下的内存泄漏风险；并补齐导出覆盖、类型测试与运行时单测。
