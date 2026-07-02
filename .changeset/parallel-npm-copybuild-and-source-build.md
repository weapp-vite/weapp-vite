---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 npm 构建中的主包与共享 source cache 构建，并将 miniprogram 目录复制改为底层批量复制，减少串行等待和目录遍历开销。
