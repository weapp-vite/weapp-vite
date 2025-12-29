---
"wevu": minor
---

新增响应式批处理与作用域能力：

- 新增 `batch`/`startBatch`/`endBatch`，支持将同一同步批次内的多次状态变更合并触发，减少重复 effect 执行。
- 新增 `effectScope`/`onScopeDispose`/`getCurrentScope`，并让 `watch`/`watchEffect` 自动注册到作用域中，便于统一销毁与避免内存泄漏。
- 修复 `watchEffect` 初始化时可能重复执行的问题（现在仅执行一次以建立依赖）。

