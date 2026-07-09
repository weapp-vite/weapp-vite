---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 shared chunk 的 importer 索引，预先收集代码级静态 import / export / require 关系并在后续查询与更新中复用，减少同一轮 bundle 里反复扫描 chunk.code 的开销。
