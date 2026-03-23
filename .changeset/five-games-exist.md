---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 在开发模式下 `autoImportComponents` 的 sidecar watcher 监听范围。现在当 globs 已能推导出明确基础目录时，sidecar watcher 不再额外监听整个 `src` 根目录，而是仅监听实际需要的组件目录，从而减少监听器覆盖面与潜在的文件监听压力。
