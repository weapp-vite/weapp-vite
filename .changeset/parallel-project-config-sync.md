---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化构建启动阶段的项目配置同步流程，在清理输出目录后将 `project.config.json` 目录同步与主 bundler 构建并行执行，减少多平台项目配置复制对 build/dev 启动关键路径的阻塞。
