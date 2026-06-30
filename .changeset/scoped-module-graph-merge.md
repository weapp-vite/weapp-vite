---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 HMR 模块图合并，只为本轮 touched entry 构建旧依赖索引，减少大项目增量更新时的全图扫描。
