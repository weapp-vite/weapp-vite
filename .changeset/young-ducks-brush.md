---
"wevu": patch
---

性能：调度器避免同一 tick 内重复安排 flush；diff 避免递归创建 key set，减少 GC 压力。

优化：支持通过 `setData` 选项控制快照字段与是否包含 computed，降低 setData 体积与快照开销。

优化：新增 `setData.strategy = "patch"`，按变更路径增量生成 setData payload（在共享引用等场景会自动回退到 diff）。

优化：patch 模式预先建立对象路径索引，减少“路径未知导致回退 diff”的概率；数组内部对象变更会回退到数组整体替换。

优化：patch 模式会合并冗余变更路径（当父路径存在时丢弃子路径），进一步减少 setData payload。

优化：`toPlain` 对 Date/Map/Set/RegExp/Error/ArrayBuffer 等值做宽松序列化，减少不可序列化导致的问题。

修复：`onErrorCaptured` 回调的 instance 参数稳定指向注册时实例。

重构：提炼 `setComputedValue` / `parseModelEventValue` 内部复用函数。
