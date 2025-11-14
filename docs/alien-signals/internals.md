# 内部实现与关键路径（基于代码阅读的工程解读）

节点模型（概念化）

- SignalNode
  - value/current：当前值
  - version：自增整型，写时 +1
  - subscribers：订阅者列表（指向 Effect/Computed）
- ComputedNode
  - compute(): T
  - cached：上次结果
  - deps：依赖的 Signal/Computed 集合（含每条边的“已见版本”）
  - dirty：布尔/位标，依赖任何一条边版本变化即置脏
- EffectNode
  - run(): void
  - deps：与 Computed 类似
  - queued：避免重复入队

依赖收集

- 在 effect/compute 执行期间设置全局“当前订阅者”：
  - signal 读 → 将“当前订阅者”加入 subscribers；订阅者同时记录“边的已见版本”（edge.seenVersion = signal.version）。
  - 依赖图是单向边，数据结构偏向数组/链表而非 Map/Set，尽量使用固定字段与对象形状以保持单形。

写与传播

1. signal.set(next)
   - 如果 Object.is(next, value) → 短路；
   - 更新 value；version++；
   - 标记直接订阅者 dirty；将“需要执行的 effect”入批队列（去重）。
2. 读取 computed.value
   - 若 dirty → 遍历依赖：
     - 若 child.version !== edge.seenVersion → 置 dirty；更新 edge.seenVersion；
   - dirty 为 false → 直接返回缓存；
   - dirty 为 true → 重新 compute()，重建依赖边与 seenVersion，并更新缓存。

批调度（scheduler）

- 典型为“微任务队列 + 去重集合”：
  - 第一次写入触发 enqueueFlush()；
  - 同一轮次所有 effect 去重执行；
  - 执行顺序按拓扑保证无环/无颠簸（如“父先于子”或“按注册先后”）。
- 任务执行期间防止 re-entrancy 导致的无限入队（队列合并/两阶段标志）。

内存与回收

- 依赖表重用：避免在每次 compute/effect 重建大量临时 Set/Map；
- 使用平坦数组或单链表节点，配合“游标 + 空闲表”减少 GC；
- 清理：effect 停止/移除时，从每个 Signal/Computed 的 subscribers 中移除（O(n) 或延迟清理）。

平凡但关键的微优化

- 避免 megamorphic（多形）对象：字段顺序与对象形状固定；
- 避免在热路径上创建闭包（回调预绑定/在创建期完成）；
- 少用 try/catch 包裹热循环（错误边界在外层）；
- 尽量用数字索引与简单 for 循环（TypedArray/普通数组按场景择优）。
