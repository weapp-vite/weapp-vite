---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化小程序文件型热更新里 shared chunk 关联项的增量判定路径，避免每次 watch 重构都全量扫描所有 shared chunk importer 集合，并补齐反向索引与回归测试以保持部分重构语义稳定。
