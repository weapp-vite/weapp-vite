---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化编译上下文创建与 support files 同步流程，将受管 tsconfig 预生成与配置加载并行启动，并让 managed tsconfig、autoRoutes、autoImport 支持文件任务并发执行，减少 dev/build 启动阶段的串行等待。
