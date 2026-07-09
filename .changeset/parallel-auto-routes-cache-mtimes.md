---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化自动路由持久化缓存的文件 mtime 校验与写入收集逻辑，减少多页面项目构建启动和缓存写入阶段的串行文件系统等待。
