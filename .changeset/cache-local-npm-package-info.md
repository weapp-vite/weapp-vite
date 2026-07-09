---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化本地分包 npm 构建，同一轮构建中复用 package info 查询结果，减少多个分包共享依赖时的重复依赖闭包解析。
