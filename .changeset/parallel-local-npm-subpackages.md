---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化本地分包 npm 构建，多分包的缓存检查、依赖筛选和过滤复制改为并行处理，降低分包数量较多时的构建等待时间。
