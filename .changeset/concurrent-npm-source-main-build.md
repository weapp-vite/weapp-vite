---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 npm 构建阶段的主包与共享 source cache 构建，改为并发启动，减少等待时间并提升构建吞吐。
