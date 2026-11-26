# @wevu/a2ui

A2UI 1.0 的组件无关小程序渲染运行时。复用 `@a2ui/web_core@0.16.1` 的消息处理、数据绑定与节点解析，把 surface 投影为纯 JSON 节点树，由消费方决定组件外观与交互入口。

当前为实验性 workspace 包，尚未发布到 npm；只承诺 A2UI 1.0 的四种 surface 状态消息与微信小程序目标。不在 AppService 中生成模板、执行模型返回的代码，也不引入 lit。

## 定位

与 `@wevu/json-render` 一样，本包只做运行时，不提供 UI 组件：

- catalog 由消费方以 A2UI 1.0 catalog 文档注入，组件集合不受本包限制；
- 投影结果是 `A2uiNode` JSON 树，渲染层用预编译递归组件按 `node.type` 静态分支，业务组件在同一组件内注册；
- 数据模型由服务端 surface 权威维护，输入写回绑定，动作以 `ActionPayload` 外发给调用方。

## 安装与构建配置

仓库内的消费项目添加 `"@wevu/a2ui": "workspace:*"` 与 `"@a2ui/web_core": "0.16.1"`，保留 `wevu` 依赖（渲染宿主使用）。原生 npm 依赖若打进小程序，需按应用的 npm 构建配置处理：

```sh
pnpm --filter @wevu/a2ui build
pnpm --filter wevu-a2ui-demo build
```

`src/compat.ts` 导出 `installA2uiRuntimeCompat()`，由 `createA2uiCatalog` 在进入 Core 前显式调用：Core 0.15 起使用 `Object.hasOwn`，0.16 起在动作解析路径构造 `AbortController`，而部分小程序基础库与 AppService 尚未提供这些内建。兼容层复用 `@wevu/web-apis/abort` 的 polyfill，宿主已有同名内建时保持原实现。这里刻意不用裸副作用导入，因为小程序构建会把无引用的副作用模块裁掉，`sideEffects` 声明并不能保证保留。

## 会话 API

```ts
import { createA2uiSession } from '@wevu/a2ui'
import catalog from './catalog.json'

const session = createA2uiSession({
  catalog,
  onSurfaces(views) {
    // views: A2uiSurfaceView[]，每项为 { id, root: A2uiNode }
    render(views)
  },
  locale: 'zh-CN',
  onAction(message, metadata) {
    // message: { version: '1.0', action: ActionPayload }
    // metadata 仅在 surface 启用 sendDataModel 时存在，由宿主映射到 transport。
    sendToAgent(message, metadata)
  },
  onError(error, metadata) {
    report(error, metadata)
  },
  functionImplementations: {
    async format(args) {
      return String(args.value)
    },
  },
})

session.receive(message) // 单条消息、消息数组或 { messages } wrapper
await session.interact(surfaceId, { type: 'input', nodeId, bindingName: 'value', value: 'hello' })
await session.interact(surfaceId, { type: 'action', nodeId, actionName: 'action', eventId: 'event-1' })
session.dispose()
```

| API | 行为 |
| --- | --- |
| `receive(message)` | 校验并应用 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface`；支持单条消息、标准数组与 `{ messages }` wrapper，RPC、内部操作及空 `surfaceId` 直接拒绝 |
| `interact(surfaceId, event)` | `input` 写回选定的可写绑定；`action` 执行选定的 Core 动作并把产生的 `ActionPayload` 按顺序交给 `onAction`，可用 `eventId` 去重 |
| `onSurfaces(views)` | 每次可见状态变化后整体推送；一批消息只提交一次最终视图，`updateDataModel` 的标量写入与 `null` 删除只更新绑定值，不替换节点 |
| `onAction(message, metadata?)` | 可返回 Promise；单个动作产生的消息按序串行等待，不同 `interact` 的异步回调可能交错；本地函数动作不会外发 |
| `onError(error, metadata?)` | 可选；接收 Core surface、消息处理与表达式错误，可返回 Promise |
| `dispose()` | 幂等；停止投影、释放 resolver 与 processor，之后不再回调 |

`functionImplementations` 为可选能力扩展。catalog 中声明的函数会保留完整签名并照常参与校验；宿主实现优先于内置实现，只按对象自身属性查找，`toString` 等继承成员不会被误当作实现。构造会话时提供未声明函数的实现会立即失败。catalog 只接受标准的 `protocolVersion: '1.0'`，文档标题、说明、扩展字段等元数据会保留。

默认启用不依赖 `Intl` 或浏览器 `window` 的标准函数：`required`、`regex`、`length`、`numeric`、`email`、`and`、`or`、`not`、`formatString`、`formatNumber`、`formatCurrency`、`formatDate`、`pluralize`。协议系统函数 `@index` 由 Core 提供。数字、货币、日期与复数函数默认使用确定性的 `zh-CN` 输出，也可通过 `locale: 'en-US'` 切换；两者均不调用 `Intl`。`formatDate` 保留时间戳写入的 wall-clock 字段，`ISO` 输出对应 UTC instant；中文 `pluralize` 按 CLDR 的 `other` 类别处理。只有返回类型、参数 schema、调用方与用户激活约束均兼容标准函数时才启用内置实现，避免把同名自定义函数误当作标准函数；`openUrl` 仍需宿主按小程序平台能力提供。其余声明保持 schema-only；本包未启用 agent RPC，因此本地求值时会通过 `onError` 上报 Core 的 schema-only 表达式错误。

宿主实现只接收已校验的参数字典，不接收 Core `DataContext` 或 `AbortSignal`，因此 `dispose()` 不会强制取消已启动的异步实现。动作 handler 不要 `await session.interact(...)`：动作捕获区通过会话级队列串行，等待同一队列会挂起。`functionCall` 动作在本地执行且不外发 `onAction`；本包不接收 `callRendererFunction` / `agentFunctionResponse`。

## 批量消息与 transport metadata

`receive` 接受单条状态消息、只读消息数组或仅含 `messages` 的 wrapper。所有成员先完成 envelope 形状校验，再逐条应用；处理阶段失败只回滚当前失败消息，已成功的前序消息保留。整批信号写入共享同一个 `batchWrite`，因此 `onSurfaces` 只收到一次最终视图；空批次是 no-op。

`createSurface.sendDataModel: true` 启用 A2UI 1.0 的 renderer data model 上报。动作捕获时会深拷贝当前所有启用该选项的 surface，并通过 `onAction` 的第二个参数传入：

```ts
interface A2uiTransportMetadata {
  readonly a2uiRendererDataModel?: {
    readonly version: '1.0'
    readonly surfaces: Record<string, Record<string, A2uiJsonValue>>
  }
}
```

没有启用 `sendDataModel` 的 surface 时不传 metadata。该快照不会修改 `ActionPayload.context`，也不会作为非标准字段混入动作消息；宿主负责把它映射到实际 transport metadata。`onError` 使用相同的可选第二参数。

## 视图投影

`A2uiNode` 的结构：

```ts
interface A2uiNode {
  readonly id: string // `${节点ID}-v${generation}`，仅在当前 generation 内稳定
  readonly componentId: string
  readonly type: string // catalog 组件名
  readonly props: { readonly [key: string]: A2uiPropValue }
  readonly children: readonly A2uiNode[]
  readonly actions: readonly string[] // 值为动作的属性名
}
```

`A2uiPropValue` 是 JSON 值、`A2uiNode` 或包含两者的递归数组/对象。直接作为属性值的组件节点与纯组件节点数组进入 `children`；嵌套在对象或混合数组中的节点保留在 `props` 原位置，例如 Basic Catalog 的 `Tabs.tabs[].child`。这些嵌套节点同样进入操作表，可执行其动作与顶层可写绑定。

- `ResolvedBinding` 投影为其当前值；`WritableBinding` 除投影值外按 catalog 属性名登记为可写输入，一个节点可以保留多个；
- 可写输入与动作分别通过 `bindingName` / `actionName` 选择；省略时仅在候选数量为 1 时回退，多个候选或显式未知名称会抛出 `TypeError`；
- 仅直接暴露在节点顶层的可写绑定可选择；深层绑定只投影当前值，深层函数属性也不会被登记为动作；
- 同一节点的可写绑定与动作可同时存在；动作执行通过会话级队列串行，异步动作完成前不会提前清理消息捕获状态；
- catalog 通过 `Checkable` 声明 `@checks` 时，Core 求值结果投影为 `props.isValid` 与 `props.validationErrors`；宿主负责展示，校验失败不会自动阻止动作；
- `updateComponents` 或非 `null` 对象型 `updateDataModel` 会递增 generation 并清空旧操作表，视图层可通过 id 变化重建引用；标量写入与 `null` 删除只更新绑定值。

```ts
interface A2uiSession {
  receive: (message: unknown) => void
  interact: (surfaceId: string, event: A2uiInteraction) => Promise<void>
  dispose: () => void
}

type A2uiInteraction
  = | { type: 'input', nodeId: string, value: A2uiJsonValue, bindingName?: string }
    | { type: 'action', nodeId: string, actionName?: string, eventId?: string }
```

`interact` 使用投影时的操作表；节点已被替换或 surface 已删除时静默忽略。

动作交互可携带非空 `eventId`。去重范围限定在单个 surface 内：相同 `eventId` 的进行中动作共享同一次执行与 `onAction` 投递；成功动作在 30 秒内直接忽略重复调用，命中时更新最近使用顺序，最多保留 256 条。动作执行或 `onAction` 投递失败时不写入成功缓存，可用相同 `eventId` 重试；`dispose()` 会清空进行中与成功记录。`input` 不支持 `eventId`。

## 渲染宿主

小程序模板不支持 `<component :is>`，渲染层需要预编译一个递归组件，为目录里的每个类型提供静态分支：

```vue
<script setup lang="ts">
import type { A2uiInteraction, A2uiNode } from '@wevu/a2ui'

const props = defineProps<{ node: A2uiNode }>()
const emit = defineEmits<{ (event: 'interaction', payload: A2uiInteraction): void }>()
defineComponentJson({
  usingComponents: { 'a2ui-node': './index', 'a2ui-order': '/components/a2ui-order/index' },
})
</script>

<template>
  <view v-if="props.node.type === 'Column' || props.node.type === 'List'">
    <a2ui-node
      v-for="child in props.node.children"
      :key="child.id"
      :node="child"
      @interaction="emit('interaction', $event)"
    />
  </view>
  <text v-else-if="props.node.type === 'Text'">{{ props.node.props.text }}</text>
  <input
    v-else-if="props.node.type === 'TextField'"
    :value="props.node.props.value"
    @input="emit('interaction', { type: 'input', nodeId: props.node.id, bindingName: 'value', value: $event.detail.value })"
  >
  <button v-else-if="props.node.type === 'Button'" @tap="emit('interaction', { type: 'action', nodeId: props.node.id })">
    {{ props.node.children[0]?.props.text }}
  </button>
  <a2ui-order v-else-if="props.node.type === 'OrderSummary'" :number="props.node.props.number" />
  <text v-else>未支持组件：{{ props.node.type }}</text>
</template>
```

宿主按 `node.type` 显式分支，未覆盖的类型渲染兜底节点；业务组件在同一递归组件的 `usingComponents` 中注册，同样按 `node.children` 渲染子节点。宿主组件的 `v-for` 使用 `node.id`（含 generation 后缀）以保证替换后重建，页面 `usingComponents` 仍按路径注册。本包不提供任何具体组件实现，`apps/wevu-a2ui-demo` 给出一份可直接参考的宿主组件。

Chat 消息编排的参考实现采用同样的 envelope 校验、generation 操作表与 `WritableBinding.set` 回写语义，组件层则直接绑定各自 UI 库的输入、按钮与卡片；本包把组件层完全留给消费方。

## 协议与边界

- 消息与 catalog：仅接受 `version: '1.0'` / `protocolVersion: '1.0'` 的 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface`；支持标准消息数组与 `{ messages }` wrapper，使用 `STRICT_VALIDATION` 与 1.0 目标版本。
- `updateComponents` 按 id upsert 且必须保持整树可达：协议不删除单个组件，隐藏节点通过绑定值表达，否则 Core 抛出可达性完整性错误。
- 节点 ID 遵循 Core 的 UAX #31 校验；模板 `ChildList`（`{ componentId, path }`）由 Core 解析，数据更新会导致实例重建。
- 支持内置标准函数、宿主 catalog 函数与 `Checkable` 校验投影；不支持 RPC 与 agent 函数响应，事件动作只外发且不等待 agent 回写。
- 不包含 Markdown 渲染、图片/勾选等目录扩展；catalog 能声明哪些组件由消费方决定，但视图层必须为每个类型提供宿主分支。
- `updateDataModel` 失败时回滚目标 surface 的整份数据快照，避免 Core 部分写入后留下半成品；失败仍会向调用方抛出。快照是 O(N) 深拷贝，数据模型很大时应优先使用更小的增量路径。
- 运行时只接受 JSON 数据；投影会丢弃未登记的函数与 `undefined`，将 `NaN`/`Infinity` 转为 `null`，并保留 props 中的嵌套组件节点。
- 无 lit、无动态求值；兼容层只补齐 `Object.hasOwn`、`AbortController` 与 `AbortSignal`。
- 需要显式调用 `dispose()`；`receive` 不接管 transport、重连或排队。

## 验证与发布边界

包级单测覆盖投影绑定、多绑定/多动作选择、嵌套槽位、输入回写、动作外发、异步动作隔离、动作幂等去重、本地 `functionCall`、标准函数与校验反馈、中文格式化与 locale、大数四舍五入与 ISO 货币默认精度、catalog 元数据与 schema-only 函数边界、批量消息单次提交、renderer data model metadata、函数错误与继承成员边界、模板列表 respawn、路径删除、消息校验、失败回滚与幂等销毁；tsd 锁定公开类型。构建产物为 ESM + d.mts，`@a2ui/web_core` 作为外部依赖由宿主应用打包。

`apps/wevu-a2ui-demo` 与 `e2e/ide/wevu-a2ui.runtime.test.ts` 提供 headless 与真实微信 DevTools 的同场景验收，覆盖基础目录页、递归宿主、校验错误展示与清除、输入写回、增量替换后的输入保留、异常消息保留上一版界面和卸载清理。应用的 `test/noEval.test.ts` 从公共入口打包，在禁用 `Function` / `eval` 的 `vm` 上下文执行。

尚未提供：内置组件包与构建期 resolver（宿主组件目前由 `apps/wevu-a2ui-demo` 自带）、catalog 子集对齐（Row/Image/ChoicePicker 等）以及 RPC 长尾。本包也未执行 npm 发布。
