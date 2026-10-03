---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发状态保持构建在页面拓扑或 workers 配置变更后读取旧入口缓存，以及 worker 产物删除时残留旧文件的问题。
