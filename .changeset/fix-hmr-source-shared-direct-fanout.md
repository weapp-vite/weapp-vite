---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 HMR sharedChunks=auto 下入口直接更新的源码 shared chunk 扩散判断，避免项目源码 shared chunk 在单入口重建后被内联或导致其他 importer 未同步，同时保留 vendor/runtime shared chunk 的窄范围热更新。
