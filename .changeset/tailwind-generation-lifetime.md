---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 一次性构建不再预初始化用不到的 Tailwind 增量候选缓存，减少样式生成耗时；watch 和开发服务继续保留增量编译复用。
