---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复共享源码模块热更新时影响范围可能无法从 shared chunk 反查到入口的问题，确保共享 TS 依赖变更能稳定触发相关入口刷新并写出更新后的共享 chunk。
