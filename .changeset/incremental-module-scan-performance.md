---
'create-weapp-vite': patch
'weapp-vite': patch
---

perf(hmr): 减少没有语义变化的 Vue 通知和模块存在性查询带来的重复扫描与完整快照。

- 内容签名忽略没有语义变化的 Vue 通知，模块存在性查询命中即停止；真实 sidecar、外部依赖、路由、样式及混合编辑仍按原语义更新。
