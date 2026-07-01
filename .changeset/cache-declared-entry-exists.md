---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 HMR 中已声明页面和组件入口的存在性探测，复用带 TTL 与 watcher 失效的路径缓存，减少单入口重建时重复文件系统查询带来的固定开销。
