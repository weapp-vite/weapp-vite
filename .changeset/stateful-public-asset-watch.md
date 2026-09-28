---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复状态保持 HMR 模式遗漏 public 目录资源监听的问题，使资源连续编辑、删除和恢复后正确更新构建产物，同时保留页面状态。
