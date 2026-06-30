---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 HMR shared chunk 裁剪流程，减少 active entry import 图的重复扫描，并保持 runtime vendor chunk 的局部刷新覆盖。
