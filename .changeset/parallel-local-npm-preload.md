---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化生产构建启动路径，本地分包 npm 的入口预加载不再阻塞主 bundler 启动，由并行的 npm 构建任务自行完成。
