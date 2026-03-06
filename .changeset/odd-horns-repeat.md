---
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `wevu` 新增 `useUpdatePerformanceListener()` 组合式 API：可在 `setup()` 中注册 `setUpdatePerformanceListener`，并在 `onUnload/onDetached` 自动清理，返回 `stop` 句柄支持手动停止；同时补齐 `SetupContextNativeInstance` 的对应类型桥接与导出覆盖测试。

同时增强 `weapp-vite` 的 `weapp.wevu.preset: 'performance'` 默认值：在保留 `patch + suspendWhenHidden + highFrequencyWarning` 的基础上，默认追加 `diagnostics: 'fallback'`，便于开发态更快定位 `setData` 回退与体积问题，并补齐相关单测与配置注释。
