---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR shared chunk 源模块索引刷新，预先建立 shared chunk 到旧模块的反向索引，减少 partial HMR 更新 shared chunk 元数据时对全量模块索引的重复扫描。
