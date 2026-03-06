---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 新增 `usePageScrollThrottle()` 组合式 API：可在 `setup()` 中直接注册节流版 `onPageScroll` 回调，支持 `interval`、`leading`、`trailing` 选项，并返回 `stop` 句柄用于手动停止监听。

该能力会在 `onUnload/onDetached` 自动清理挂起的 trailing 定时器，避免页面销毁后残留滚动任务；同时补齐运行时导出覆盖与类型测试，确保 API 可用性与类型推导稳定。
