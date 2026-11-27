# 投影、输入与动作

## A2uiNode

```ts
interface A2uiNode {
  readonly id: string
  readonly componentId: string
  readonly type: string
  readonly props: Record<string, A2uiPropValue>
  readonly children: readonly A2uiNode[]
  readonly actions: readonly string[]
}
```

- `id` 是 `${Core 解析节点 id}-v${generation}`，只在当前 generation 稳定；它不是协议 `componentId` 加后缀。
- `componentId` 保留协议组件 ID，`type` 是 catalog 组件名；宿主选择静态分支用 `type`，交互和 `v-for` key 用 `id`。
- 直接属性中的组件节点和纯组件数组进入 `children`。
- 对象深层或混合数组中的节点保留在 `props` 原位置；宿主需递归处理嵌套节点。
- 只读绑定投影当前值；可写绑定同时登记输入操作。
- 不可序列化值与未登记函数不进入视图；非有限数字投影为 `null`。
- `Checkable` 结果投影为 `props.isValid` / `props.validationErrors`，失败只供宿主展示，不自动拦截动作。

## 输入回写

```ts
await session.interact(surfaceId, {
  type: 'input',
  nodeId,
  bindingName: 'value',
  value: 'hello',
})
```

仅节点顶层 `WritableBinding` 可选。省略 `bindingName` 时，只有一个候选才隐式选择；多个候选或显式未知名称抛出 `TypeError`。深层绑定只投影值，不能直接写回。

## 动作

```ts
await session.interact(surfaceId, {
  type: 'action',
  nodeId,
  actionName: 'submit',
  eventId: 'submit-42',
})
```

- 一个节点可同时有多个输入和多个动作；多候选必须指定属性名。
- `actions` 列出当前节点顶层函数属性名，宿主按属性名决定触发入口。
- 会话级队列串行执行 Core 本地动作；每个动作捕获的消息按序投递 `onAction`，但不同动作的 `onAction` 回调可能在队列外交错。不要在该 handler 内 `await session.interact(...)`，否则等待自身所在队列。
- 本地 `functionCall` 由 catalog 函数执行，不产生 `onAction`；外部事件动作产生标准 `ActionPayload`。
- 包只发送，不等待 agent 的数据回写。

## eventId 幂等

去重键为 `(surfaceId, eventId)`：

- 非空字符串；`input` 不支持。
- 进行中共享同一执行与 `onAction` 投递。
- 成功后 30 秒内直接忽略重复调用，并刷新最近使用顺序。
- 最多保存 256 条；执行或投递失败不写成功缓存，可重试。
- `dispose()` 清空记录；eventId 不是永久业务主键。

## generation

`updateComponents` 或对象/数组整体型 `updateDataModel` 会递增 generation、清空旧操作表。宿主 `v-for` 使用投影 id 强制重建替换节点；不要缓存旧 nodeId 跨 generation 使用。

标量写入和 `null` 删除只更新绑定值，不替换节点；视图层应显示绑定后的新值。`interact` 遇到已删除节点或 surface 时静默忽略。
