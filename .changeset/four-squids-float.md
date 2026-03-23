---
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite` 新增 `weapp.debug.vueTransformTiming` 调试回调，用于输出 Vue 文件在 transform 阶段的分段耗时。启用后可观察单次编译中 `readSource`、`preParseSfc`、`compile`、页面后处理等步骤的耗时分布，便于继续分析和优化热更新与构建性能。
