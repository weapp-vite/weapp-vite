---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 partial HMR shared chunk importer 清理逻辑，优先通过 entry 到 shared chunk 的反向索引清除旧关系，减少每次局部刷新时扫描全部 shared chunk importer 的成本。
