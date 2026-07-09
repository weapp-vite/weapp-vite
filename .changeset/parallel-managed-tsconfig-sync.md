---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 managed tsconfig 支持文件同步，复用已生成的文件列表并并发检查、写入，减少 prepare 和构建启动阶段的重复生成与串行 IO。
