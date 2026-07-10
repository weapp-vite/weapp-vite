---
"weapp-vite": minor
"create-weapp-vite": minor
---

优化构建启动、自动路由、配置发现和 npm 处理流程：并行执行可独立的目录扫描、配置加载、包信息解析、文件复制与平台归一化任务，并复用 managed tsconfig、组件 metadata、入口探测和本地 npm 依赖闭包缓存。多分包项目会减少串行等待、重复文件系统查询和 bundle 后处理遍历，提升开发启动与生产构建吞吐。
