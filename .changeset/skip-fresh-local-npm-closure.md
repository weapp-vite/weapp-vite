---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化本地分包 npm 增量构建，缓存和输出都未过期时跳过依赖闭包分析与 package metadata 查询，减少无效构建等待。
