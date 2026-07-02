---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化生成阶段的脚本分析 warmup 复用，让 npm 重写和平台 API 重写共享同一轮分析缓存，减少 bundle 后处理里的重复扫描与准备开销。
