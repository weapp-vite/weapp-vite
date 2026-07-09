---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR 生成后的模块依赖图增量刷新，merge 模式下预先索引 entry 对应的旧模块依赖，减少 partial HMR 时重复扫描全量 importer 图的成本。
