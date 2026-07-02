---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发 HMR 的 bundle rewrite 范围：在非全量刷新时只处理当前活跃入口、受影响 shared chunk 及其直接依赖，并在没有 npm rewrite 目标时跳过对应扫描，减少重复 AST 分析和无效 rewrite 开销。
