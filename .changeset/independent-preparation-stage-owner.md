---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf: 完整入口重建时由 buildStart 统一准备独立分包输出，移除 options 阶段的重复子构建，并保留入口解析后最新源码、分包拓扑和失败发布语义。
