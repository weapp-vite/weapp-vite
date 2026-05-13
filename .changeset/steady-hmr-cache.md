---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序 dev/HMR 增量构建中共享 chunk 命名缓存被重置导致页面入口引用旧 runtime helper 的问题，避免热更新后出现压缩 helper 名漂移引发的运行时报错。
