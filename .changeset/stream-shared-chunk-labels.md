---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化分包 shared chunk fallback 日志的模块标签生成，改为单次遍历收集预览和计数，减少 build/HMR 生成阶段的临时数组分配。
