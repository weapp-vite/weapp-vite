---
"weapp-vite": patch
"create-weapp-vite": patch
---

减少 watcher 阶段模板依赖遍历和独立分包匹配的临时数组分配，降低 HMR dirty 标记固定成本。
