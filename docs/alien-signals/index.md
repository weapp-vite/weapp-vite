# alien-signals 概览（工程解读）

目标

- alien-signals 是一个极致追求“读/写/传播”常数开销的信号（Signals）实现，围绕 signal/computed/effect 三个原语构建最小可依赖图，重点在于：
  - 消除热路径上的多余装箱与分配；
  - 保持隐藏类单形（monomorphic）以利于 JIT 内联缓存（IC）命中；
  - 用轻量的“版本/脏位 + 拓扑调度 + 去重队列”组合避免重复计算与抖动。

核心 API（典型）

- signal<T>(value: T)：可变值容器，读时建立依赖，写时传播。
- computed<T>(fn: () => T)：惰性求值，缓存上次结果，按依赖版本决定是否重算。
- effect(fn: () => void)：副作用订阅，批量调度到微任务（或自定义队列）执行。

思想速记

- 以“值”为中心而非“对象代理”，避免 Proxy 带来的通用开销；
- 依赖图是“点对点边”而不是“全量收集”，每条边是轻量节点或数组槽位；
- 传播使用“版本号 + 脏标”快速短路（child.version === parent.seenVersion → 跳过）；
- 调度为去重、拓扑安全的批队列，避免深度递归与重复入队。

本文档套件

- internals.md：内部数据结构与关键热路径拆解
- performance.md：为什么快/快在哪里（与其他响应系统对照）
- comparison.md：与 Vue/Solid/Preact/RxJS 等常见方案差异
- compatibility-and-gotchas.md：语义、等值/比较、清理等注意事项
