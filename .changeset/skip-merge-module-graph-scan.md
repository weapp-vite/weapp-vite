---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 HMR 模块图刷新，partial bundle 合并时跳过 Rolldown 全量 module graph 扫描，只使用当前输出更新 touched entries。
