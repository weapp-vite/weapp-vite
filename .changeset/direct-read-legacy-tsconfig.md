---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化旧版根 tsconfig 兼容读取，改为直接读取并捕获缺失文件，减少 prepare 与构建启动阶段的额外存在性检查。
