---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 watcher create 事件中 emitted JSON path 的收集方式，减少 watch 到 dirty 阶段的临时数组分配。
