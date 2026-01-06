---
"wevu": patch
---

性能：调度器避免同一 tick 内重复安排 flush；diff 避免递归创建 key set，减少 GC 压力。

修复：`onErrorCaptured` 回调的 instance 参数稳定指向注册时实例。

重构：提炼 `setComputedValue` / `parseModelEventValue` 内部复用函数。

