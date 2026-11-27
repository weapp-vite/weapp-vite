# Wevu A2UI renderer

`@wevu/a2ui` 是独立的实验性 A2UI 1.0 运行时适配包，直接依赖 `@a2ui/web_core@0.16.1`，提供 surface 会话、视图投影、输入回写、catalog 函数执行与动作外发，不含具体渲染组件。

- 包源码与完整使用说明：`packages-runtime/a2ui/README.md`。
- 应用示例：`apps/wevu-a2ui-demo`，宿主递归组件、售后目录与假 agent 回包保留在应用中。
- 站点入口：`website/packages/wevu-a2ui.md`。
- Agent Skill：`wevu-a2ui-best-practices`，覆盖 surface 消息、数据模型、投影交互、catalog 函数与静态递归宿主。
- 运行时入口：`createA2uiSession`，通过 `A2uiSurfaceView`、`A2uiNode`、`A2uiInteraction`、`A2uiActionMessage` 与 `A2uiErrorMessage` 连接宿主 SFC。

预编译的通用宿主组件包尚未提供，消费项目当前自带递归组件并按 `A2uiNode.type` 静态分支；接入不需要构建期 resolver。

## 会话接入

```ts
const session = createA2uiSession({
  catalog,
  onSurfaces: render,
  onAction: sendToAgent,
  onError: report,
  functionImplementations: {
    format: async args => String(args.value),
  },
})

session.receive(message)
await session.interact(surfaceId, {
  type: 'input',
  nodeId,
  bindingName: 'value',
  value: 'hello',
})
await session.interact(surfaceId, { type: 'action', nodeId, actionName: 'action' })
session.dispose()
```

输入值限定为 JSON 值。节点有多个顶层可写绑定时必须提供 `bindingName`；节点有多个动作时必须提供 `actionName`。省略选择器只在一个候选时生效，未知名称或歧义会抛出 `TypeError`。已替换或删除的节点 ID 仍静默忽略。

`onAction` 与 `onError` 都可以返回 Promise。动作按会话级队列串行执行，异步动作完成前持续捕获其产生的消息；单个动作的消息按序等待，但不同 `interact` 的异步回调可能交错。消息回调在动作执行锁之外等待，因此 `onAction` 监听器可以再次调用 `interact`；catalog 函数 handler 内不要 `await interact`，否则会等待同一动作队列。本地 catalog 函数动作不会作为 agent 动作外发。

## 投影与槽位

直接属性中的组件节点和纯组件节点数组进入 `children`。对象内或混合数组内的组件节点保留在 `props`，例如 `Tabs.tabs[].child`；宿主需要递归读取这些节点，它们也参与动作操作表登记。深层绑定只投影当前值，不能通过 `bindingName` 独立选择。

`receive` 只接受 A2UI 1.0 的 `createSurface`、`updateComponents`、`updateDataModel` 与 `deleteSurface`。失败的 `updateDataModel` 会回滚目标 surface 的数据快照，避免部分写入污染后续绑定；快照会对整份数据模型做 O(N) 深拷贝。

## 函数与错误边界

catalog 中声明的函数保留签名并参与校验。宿主可通过 `functionImplementations` 提供实现；未实现函数在调用时产生表达式错误并交给 `onError`，为未声明函数提供实现则会在构造会话时失败。查找只接受对象自身属性，`toString` 等继承成员不会被误用。

实现接收已校验的参数字典，不接收 Core `DataContext` 或 `AbortSignal`；`dispose()` 只停止后续消息投递，不会强制取消已经启动的异步实现。直接 `functionCall` 动作在本地执行，不进入 `onAction`。

本包支持 Core 的 `@checks` / `Checkable` 校验投影，通过 `isValid` 与 `validationErrors` 提供给宿主展示；不会自动阻止动作。不支持 `callRendererFunction`、`agentFunctionResponse` 或 agent 函数响应协议。运行时不生成模板、不执行模型返回的代码，也不引入 lit。

## 验证

先重建 `@wevu/a2ui`，再验证下游应用。真实微信 DevTools 和 headless 复用 `e2e/ide/wevu-a2ui.runtime.test.ts`，测试命令必须全局串行；基础目录页同时验证 `Tabs.tabs[].child` 的嵌套渲染。应用的 noEval 测试从公共入口打包，并在禁用 `Function` / `eval` 的 VM 中执行。

包未执行 npm 发布，不承诺完整 Basic Catalog、RPC 或其他平台支持。
