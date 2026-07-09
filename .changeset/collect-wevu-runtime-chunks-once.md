---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Wevu runtime 稳定化后处理，同一轮遍历内收集 runtime chunk 与文件名索引，减少构建和 HMR rewrite 阶段的临时数组与二次遍历。
