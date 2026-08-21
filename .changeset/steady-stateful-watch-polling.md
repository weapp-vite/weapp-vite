---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复状态保持 HMR 未继承轮询 watcher 配置的问题，确保原子重命名保存源码时能够稳定检测变更并生成增量补丁。
