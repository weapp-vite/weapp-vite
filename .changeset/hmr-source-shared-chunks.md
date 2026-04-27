---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态 HMR 的 shared chunk 局部更新策略：入口文件直接变更时仅对包含项目源码的 shared chunk 扩散相关 importers，避免源码 shared chunk 被单入口构建内联，同时保留纯运行时或 vendor shared chunk 的快速单入口更新路径。
