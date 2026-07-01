---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 auto-routes 全量扫描阶段的候选文件收集，将多个 pages / 分包搜索根的文件爬取改为并发执行，减少多目录项目构建时的串行扫描等待。
