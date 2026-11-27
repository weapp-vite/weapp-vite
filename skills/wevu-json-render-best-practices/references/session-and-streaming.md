# 会话、动作与 SpecStream

## 选择入口

- 页面/组件同步 `setup()`：使用 `useJsonRenderer(options)`，自动绑定卸载清理。
- 非组件或需要显式所有权：使用 `createJsonRenderer(options)`，调用方负责 `dispose()`。
- 独立解析/校验：使用 `validateRendererSpec(spec, catalog, state, limits?)`，不要把 TypeScript 断言当运行时校验。

## 会话方法

| 方法 | 使用方式 |
| --- | --- |
| `dispatch(event)` | 统一输入写回和动作调度；返回 `Promise<boolean>` |
| `setState(path, value)` | 写现有状态路径并校验当前可见 props |
| `load(spec, nextState?)` | 事务化替换 spec；失败保留旧树并返回 false |
| `createStream(initialSpec?)` | 创建新流，旧流失效；可重播完整初始 spec |
| `stream.push(text, done?)` | 会话包装应用 JSONL 分块；完整新树提交时返回 `true`，暂未提交、已停止或失效时返回 `false` |
| `createSpecStream(...).push(text, done?)` | 独立解析器；返回新 spec，暂未提交时返回 `null`，并可能抛出错误 |
| `stream.dispose()` | 停止当前流并清空缓冲 |
| `dispose()` | 停止流、执行清理并阻止旧上下文写入；幂等 |

## 异步动作

```ts
const renderer = useJsonRenderer({
  catalog,
  spec,
  initialState: { count: 0 },
  actions: {
    increase: async ({ step }, context) => {
      context.onCleanup(() => controller.abort())
      const next = await loadNext(step, controller.signal)
      if (context.isActive()) {
        context.setState('/count', next)
      }
    },
  },
})
```

- 同一节点同名进行中动作去重；不要把去重键扩大到所有节点而改变业务语义。
- `context.state` 是会话响应式状态引用，不是动作开始时的快照；提交结果使用 `context.setState`，不要直接修改内部状态。
- `onCleanup` 在动作结束、重置或卸载时执行一次；清理函数同时结束已取消的等待，避免任务继续占用资源。
- 包不接管网络请求，也不保证宿主存在 `AbortController`；宿主负责请求和取消策略。

## JSONL Patch

只接受 `add` / `replace` / `remove`，路径只允许 `/root` 与 `/elements`。每行是独立 Patch，支持先引用后补节点。

```text
{"op":"replace","path":"/elements/title/props/text","value":"处理中"}
{"op":"add","path":"/elements/notice","value":{"type":"Text","props":{"text":"请稍候"}}}
```

- 半行、暂时不可达引用和中间非法树可暂存；`done` 时必须形成完整合法树。
- 待解析缓冲超限、非法 Patch 或结束仍不完整会停止流并记录错误；旧界面保留，不提交半成品。
- 流更新只改 spec，不改业务状态；需要保留输入时由状态路径和 `$bindState` 承担。

## 故障定位

1. 先看 `error` 和 `pending`，区分 schema、结构、动作和流错误。
2. 输入未回写：检查组件 `bindings`、事件 payload、`$bindState` 路径和节点可见性。
3. 动作重复：检查同节点同名进行中去重，不重复注册 dispatcher。
4. 重置后旧结果出现：检查 `isActive` / `onCleanup`，不要用延时掩盖竞态。
5. 流停在半行：检查 chunk 边界、`done` 与缓冲上限；会话包装的 `false` 或独立解析器的 `null` 可表示尚未提交，结合 `error` 与调用方错误处理区分真实失败。
