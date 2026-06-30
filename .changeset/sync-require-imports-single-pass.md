---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 bundle require import 同步逻辑，一次遍历同时收集 chunk 文件名和含 require 的 chunk，减少生成阶段的数组分配和无关 chunk 扫描。
