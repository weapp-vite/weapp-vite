---
"wevu": patch
---

性能：调度器避免同一 tick 内重复安排 flush；diff 避免递归创建 key set，减少 GC 压力。

优化：支持通过 `setData` 选项控制快照字段与是否包含 computed，降低 setData 体积与快照开销。

优化：新增 `setData.strategy = "patch"`，按变更路径增量生成 setData payload（在共享引用等场景会自动回退到 diff）。

优化：patch 模式预先建立对象路径索引，减少“路径未知导致回退 diff”的概率；数组内部对象变更会回退到数组整体替换。

优化：patch 模式会合并冗余变更路径（当父路径存在时丢弃子路径），进一步减少 setData payload。

优化：patch 模式对 computed 做“脏 key 收集”，只对变更的 computed 计算与下发，降低开销。

优化：patch 模式支持 `maxPatchKeys/maxPayloadBytes` 阈值，变更路径或 payload 过大时自动回退到 diff。

优化：patch 模式支持 `mergeSiblingThreshold`，当同一父路径下出现多个子路径变更时合并为父路径下发，进一步减少 keys 数与调度开销。

优化：patch 模式优化 `collapsePayload` 与 payload 大小估算，减少不必要的字符串化与分配开销。

优化：patch 模式 computed 下发逻辑优化，减少不必要的 diff 计算与对象分配。

优化：patch 模式支持通过 `computedCompare/computedCompareMaxDepth/computedCompareMaxKeys` 控制 computed 对比开销，避免大对象递归比较过慢。

优化：卸载时清理 patch 模式的内部路径索引，降低长期运行内存占用与索引维护成本。

优化：`collapsePayload` 使用排序 + 前缀栈扫描替代逐层 ancestor 查找，减少路径去重开销。

优化：patch 模式支持 `debug` 回调输出回退原因与 key 数，便于调参与定位性能瓶颈。

优化：patch 模式支持 `prelinkMaxDepth/prelinkMaxKeys` 限制预链接开销，避免大 state 初始化卡顿。

优化：同级合并支持 `mergeSiblingMaxInflationRatio/mergeSiblingMaxParentBytes/mergeSiblingSkipArray`，减少“合并反而变大”的负优化。

优化：`toPlain` 对 Date/Map/Set/RegExp/Error/ArrayBuffer 等值做宽松序列化，减少不可序列化导致的问题。

修复：`onErrorCaptured` 回调的 instance 参数稳定指向注册时实例。

重构：提炼 `setComputedValue` / `parseModelEventValue` 内部复用函数。
