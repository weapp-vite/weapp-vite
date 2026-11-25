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
  onAction(message) {
    // message: { version: '1.0', action: ActionPayload }
    socket.send(message)
  },
})

session.receive(message) // 单个 A2UI 1.0 状态消息
await session.interact(surfaceId, { type: 'input', nodeId, value })
await session.interact(surfaceId, { type: 'action', nodeId })
session.dispose()
```

| API | 行为 |
| --- | --- |
| `receive(message)` | 校验并应用 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface`；RPC、内部操作、批量消息及空 `surfaceId` 直接拒绝 |
| `interact(surfaceId, event)` | `input` 写回可写绑定；`action` 执行 Core 动作并把产生的 `ActionPayload` 按顺序交给 `onAction` |
| `onSurfaces(views)` | 每次可见状态变化后整体推送；`updateDataModel` 的标量写入与 `null` 删除只更新绑定值，不替换节点 |
| `onAction(message)` | 可返回 Promise，动作消息按产生顺序串行等待 |
| `dispose()` | 幂等；停止投影、释放 resolver 与 processor，之后不再回调 |

创建会话时构造的 catalog 只保留组件声明与 `$defs`，函数实现为空数组。因此节点上的动作属性仍是 Core 生成的可执行 RPC 入口，但本包不接收 `callRendererFunction` / `agentFunctionResponse`，动作结果统一通过 `onAction` 外发。

## 视图投影

`A2uiNode` 的结构：

```ts
interface A2uiNode {
  readonly id: string // `${节点ID}-v${generation}`，仅在当前 generation 内稳定
  readonly componentId: string
  readonly type: string // catalog 组件名
  readonly props: { readonly [key: string]: A2uiJsonValue }
  readonly children: readonly A2uiNode[]
  readonly actions: readonly string[] // 值为动作的属性名
}
```

- 子节点来自属性中的单个组件、组件数组或 `ChildList` 模板展开结果，按属性出现顺序收集，不进入 `props`；
- `ResolvedBinding` 投影为其当前值；`WritableBinding` 除投影值外登记为可写输入，一个节点最多保留一个；
- 同一节点的可写绑定与动作可同时存在；
- `updateComponents` 或非 `null` 对象型 `updateDataModel` 会递增 generation 并清空旧操作表，视图层可通过 id 变化重建引用；标量写入与 `null` 删除只更新绑定值。

```ts
interface A2uiSession {
  receive: (message: unknown) => void
  interact: (surfaceId: string, event: A2uiInteraction) => Promise<void>
  dispose: () => void
}

type A2uiInteraction
  = | { type: 'input', nodeId: string, value: string }
    | { type: 'action', nodeId: string }
```

`interact` 使用投影时的操作表；节点已被替换或 surface 已删除时静默忽略。

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
    @input="emit('interaction', { type: 'input', nodeId: props.node.id, value: $event.detail.value })"
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

- 消息：仅 `version: '1.0'` 的 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface`；使用 `STRICT_VALIDATION` 与 1.0 目标版本。
- `updateComponents` 按 id upsert 且必须保持整树可达：协议不删除单个组件，隐藏节点通过绑定值表达，否则 Core 抛出可达性完整性错误。
- 节点 ID 遵循 Core 的 UAX #31 校验；模板 `ChildList`（`{ componentId, path }`）由 Core 解析，数据更新会导致实例重建。
- 不支持 catalog 函数、checks 与 RPC；动作只外发事件，不等待 agent 回写。
- 不包含 Markdown 渲染、图片/勾选等目录扩展；catalog 能声明哪些组件由消费方决定，但视图层必须为每个类型提供宿主分支。
- 运行时只接受 JSON 数据；投影会丢弃函数、`undefined`、`NaN`/`Infinity`（转为 `null`），组件节点出现在对象属性中时转换为 `componentId`。
- 无 lit、无动态求值；兼容层只补齐 `Object.hasOwn`、`AbortController` 与 `AbortSignal`。
- 需要显式调用 `dispose()`；`receive` 不接管 transport、重连或排队。

## 验证与发布边界

包级单测覆盖投影绑定、输入回写、动作外发、模板列表 respawn、消息校验、失败回滚与幂等销毁；tsd 锁定公开类型。构建产物为 ESM + d.mts，`@a2ui/web_core` 作为外部依赖由宿主应用打包。

`apps/wevu-a2ui-demo` 与 `e2e/ide/wevu-a2ui.runtime.test.ts` 提供 headless 与真实微信 DevTools 的同场景验收，覆盖基础目录页、递归宿主、输入写回、增量替换后的输入保留、异常消息保留上一版界面和卸载清理。应用的 `test/noEval.test.ts` 从公共入口打包，在禁用 `Function` / `eval` 的 `vm` 上下文执行。

尚未提供：内置组件包与构建期 resolver（宿主组件目前由 `apps/wevu-a2ui-demo` 自带）、catalog 子集对齐（Row/Image/ChoicePicker 等）以及函数/checks/RPC 长尾。本包也未执行 npm 发布。
