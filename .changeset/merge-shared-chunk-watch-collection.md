---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 shared chunk source HMR 的 watcher 扩散阶段，合并受影响 entry 与 chunk 的收集遍历，减少 shared chunk 图的重复查询成本。
