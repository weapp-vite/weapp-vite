---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR pending entry 解析中的 shared chunk 和 CSS importer 代表入口选择，减少热路径临时数组分配。
