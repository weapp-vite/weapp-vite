---
'wevu': patch
'create-weapp-vite': patch
---

优化 `wevu` 的 `toPlain` 热路径，减少高频 `setData` flush 中递归序列化时的临时对象分配与回调开销。对于类似 runtime-bench 里的大数组微提交场景，可进一步降低 `metricMs` 与 `flushMs`，缩小 wevu 与原生运行时之间的提交收敛差距。
