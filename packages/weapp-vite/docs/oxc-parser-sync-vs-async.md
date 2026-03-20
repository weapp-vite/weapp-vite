# oxc-parser 同步与异步解析说明

本文记录 `oxc-parser@0.119.0` 中 `parseSync` 与 `parse` 的差异、一次本地 benchmark 结果，以及 `weapp-vite` 当前为什么继续使用同步解析。

## 结论

在当前版本里，`parseSync` 通常比 `parse` 更快，或者至少不会更慢。

对于 `oxc-parser` 这类 CPU 密集型任务，异步接口并不意味着解析吞吐更高。`parse` 会把 Rust 侧解析放到单独线程，但 AST 反序列化仍需要回到当前线程执行，因此异步接口存在线程调度和 Promise 包装的额外开销。

`weapp-vite` 当前在 [src/ast/engines/oxc.ts](../src/ast/engines/oxc.ts) 中继续使用 `parseSync`，这是符合上游实现建议的。

## 上游实现依据

`oxc-parser` 在 [node_modules/oxc-parser/src-js/index.js](../node_modules/oxc-parser/src-js/index.js) 的注释里明确说明：

- `parseSync` 在当前线程同步解析。
- `parse` 会在单独线程做 Rust 侧解析。
- 但 AST 反序列化仍必须在当前线程完成。
- 这部分同步反序列化通常比异步解析重 `3` 到 `20` 倍。
- 因此一般更推荐 `parseSync`；如果要并行很多文件，更合适的方式是 `worker_threads + parseSync`。

## 本地 benchmark

测试时间：`2026-03-15`

测试环境：

- 仓库当前依赖版本：`oxc-parser@0.119.0`
- 样本文件：[src/runtime/autoImport/weappBuiltinHtmlTagsData.ts](../src/runtime/autoImport/weappBuiltinHtmlTagsData.ts)
- 文件大小：约 `106 KB`
- 每轮迭代：`60` 次
- 轮数：`5`

结果：

- `parseSync` 平均总耗时：`35.24 ms`
- `parse` 平均总耗时：`40.55 ms`
- `parseSync` 单次平均：`0.587 ms`
- `parse` 单次平均：`0.676 ms`
- 异步相对同步慢约：`15%`

本次 benchmark 结论与上游源码说明一致。

## 使用建议

- 单文件解析或串行解析：优先 `parseSync`
- 只是为了使用 `await` 风格 API：可以用 `parse`，但不要默认认为它更快
- 要提升多文件并行吞吐：优先考虑 `worker_threads + parseSync`
