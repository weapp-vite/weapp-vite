---
"weapp-vite": patch
"create-weapp-vite": patch
---

并发扫描 auto-routes 默认 pages 根目录发现阶段，减少多目录项目在路由候选收集前的串行 readdir 等待。
