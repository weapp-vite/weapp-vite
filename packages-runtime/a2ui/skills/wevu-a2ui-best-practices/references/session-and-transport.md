# 会话、消息与 transport

## 创建与销毁

```ts
import { createA2uiSession } from '@wevu/a2ui'
import catalog from './catalog.json'

const session = createA2uiSession({
  catalog,
  onSurfaces(views) {
    render(views)
  },
  onAction(message, metadata) {
    return sendToAgent(message, metadata)
  },
  onError(error, metadata) {
    report(error, metadata)
  },
  functionImplementations: {},
})
```

`receive` / `interact` / `dispose` 三个方法构成全部会话 API。包不连接 WebSocket、不重连、不等待 agent 回写，也不提供 RPC。

## 单条消息

- `createSurface`：创建 surface；可声明 `sendDataModel`。
- `updateComponents`：按 id 更新/新增，必须保持整树可达；不能删除单个组件。
- `updateDataModel`：写服务端权威的数据模型；对象/数组整体替换与标量/null 删除的重建语义不同。
- `deleteSurface`：删除 surface 与关联 resolver。

只接受 `version: '1.0'`、恰好一个上述字段。`receive` 另接受标准数组和仅含 `messages` 的 wrapper；所有成员先做 envelope 形状校验，空批次为 no-op。

```ts
session.receive({
  version: '1.0',
  createSurface: {
    surfaceId: 'order-1',
    catalogId: catalog.catalogId,
    components: [{ id: 'root', component: 'Column', children: [] }],
  },
})
```

实际字段以所用 A2UI 1.0 catalog/消息文档为准；不要从示例复制组件 schema。

## 批次与失败

- 一个批次共享一次写入，只回调最终 `onSurfaces`。
- 处理阶段失败只回滚当前消息，之前成功的消息保留；调用方仍收到异常。
- `updateDataModel` 使用整份数据快照回滚，代价为 O(N)，大模型优先小增量。
- 内联 `createSurface` 在组件批次校验失败时会撤销刚创建的 surface，避免残留半成品。
- envelope 校验失败发生在任何应用之前，不会产生半批副作用。

## transport metadata

`sendDataModel: true` 的 surface 会在动作捕获时深拷贝当前数据，通过 `onAction` / `onError` 的第二参数传递 `{ version: '1.0', surfaces }`。不要把它塞入 `ActionPayload.context` 或动作 JSON；由宿主映射到实际 transport。

## 故障定位

1. **完全没有回调**：surface 是否创建、root 是否投影成功、是否在 `dispose` 后调用。
2. **收到空数组**：检查空批次与空 surface 的可见性语义，不据此重发整批。
3. **只收到一帧**：确认是 `receive` 批次合并，不是渲染层丢更新。
4. **部分更新后异常**：保留已成功前序消息；定位当前消息与回滚，不重放整批。
5. **metadata 缺失**：检查目标 surface 的 `sendDataModel`，不是所有 surface 都会发送快照。
