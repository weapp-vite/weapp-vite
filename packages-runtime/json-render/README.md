# @wevu/json-render

json-render 的 Wevu 微信小程序适配层。复用 `@json-render/core@0.21.0` 的表达式、绑定与 SpecStream 解析，以预编译 SFC 渲染界面，并通过小程序泛型组件接入业务组件。

当前为实验性 workspace 包，尚未发布到 npm；首轮仅承诺本页列出的协议子集与微信目标。不会在 AppService 中生成模板或执行模型返回的代码。

## 安装与构建配置

仓库内的消费项目添加 `"@wevu/json-render": "workspace:*"` 与 `"@wevu/json-render-components": "workspace:*"`，并保留 `wevu` 和 `zod` 依赖。小程序 npm 构建按应用显式依赖识别组件包，因此配套组件也要列入应用 dependencies；业务代码只导入主包 API。包先构建，再构建应用：

```sh
pnpm --filter @wevu/json-render-components build
pnpm --filter @wevu/json-render build
pnpm --filter wevu-json-render-demo build
```

注册构建期 resolver，使用包内由 weapp-vite lib 模式预编译的组件：

```ts
import { JsonRendererResolver } from '@wevu/json-render/resolver'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoImportComponents: { resolvers: [JsonRendererResolver()] },
  },
})
```

`/resolver` 是独立的构建入口。主包保持 ESM 运行时入口，响应式 API 随宿主应用打包。自动依赖的 `@wevu/json-render-components` 通过 Vite/Rolldown lib emit 产出递归组件与默认组件，其 `miniprogram` 字段用于宿主 npm 解析。两者分开，避免响应式 API 进入另一份原生 npm 运行时。无需复制组件源码；应用需要显式声明配套组件依赖，resolver 负责组件注册。

## 目录、状态与动作

```ts
import type { CatalogSpec } from '@wevu/json-render'
import { defineRendererCatalog, standardComponents, useJsonRenderer } from '@wevu/json-render'
import { z } from 'zod'

z.config({ jitless: true })

const catalog = defineRendererCatalog({
  components: {
    ...standardComponents,
    Counter: {
      props: z.object({ value: z.number() }).strict(),
      events: ['increase'],
    },
  },
  actions: { increase: z.object({ step: z.number() }).strict() },
})

const spec: CatalogSpec<typeof catalog> = {
  root: 'counter',
  elements: {
    counter: {
      type: 'Counter',
      props: { value: { $state: '/count' } },
      on: { increase: { action: 'increase', params: { step: 1 } } },
    },
  },
}

// 在页面或组件同步 setup 中调用。
const renderer = useJsonRenderer({
  catalog,
  spec,
  initialState: { count: 0 },
  actions: {
    increase({ step }, context) {
      context.setState('/count', context.state.count + step)
    },
  },
})
const tree = renderer.tree
const onNodeEvent = renderer.dispatch
```

`props` schema 校验表达式求值后的属性；动作参数在执行前校验，因此尚未填写的表单不会因动作参数校验而阻止首屏渲染。输入绑定由组件目录的 `bindings` 映射声明，例如 `{ value: 'input' }`；对应事件携带 `value`，由适配层写回 `$bindState` 指向的现有状态路径。

`CatalogSpec<typeof catalog>` 推导组件名称、属性类型和动作参数；`ActionHandlers` 推导处理器参数和业务状态。运行时仍验证从网络等边界传入的未知数据。

## 自定义组件

在页面 JSON 中静态注册业务节点，模板中将其传给 renderer 的 `custom-node` 泛型：

```vue
<script setup lang="ts">
definePageJson({
  usingComponents: { 'business-node': '/components/business-node/index' },
})
// tree 与 onNodeEvent 来自上面的 renderer。
</script>

<template>
  <json-renderer v-if="tree" :node="tree" generic:custom-node="business-node" @node-event="onNodeEvent" />
</template>
```

业务节点接收 `RenderNode`，通过静态分支选择预注册组件，通过 `node-event` 发出 `RendererEvent`。Wevu 自定义事件会解包 detail；原生 input 事件仍读取 `event.detail.value`。

```vue
<script setup lang="ts">
import type { RendererEvent, RenderNode } from '@wevu/json-render'

const props = defineProps<{ node: RenderNode }>()
const emit = defineEmits<{ (event: 'node-event', payload: RendererEvent): void }>()
function increase() {
  emit('node-event', { id: props.node.id, name: 'increase' })
}
</script>

<template>
  <view v-if="props.node.type === 'Counter'">
    <text>{{ props.node.props.value }}</text>
    <button @tap="increase">增加</button>
  </view>
</template>
```

业务容器可在目录中声明 `container: true`，并在自己的模板里提供默认 `<slot />` 接收渲染后的子节点。泛型映射逐层传递，组件身份以 spec 节点 ID 保持。只有基础控件的界面可不提供业务节点；使用自定义类型时必须注册对应分支。本包不使用 `<component :is>`，也不承诺 Web Vue 的 VNode 语义。

## 会话 API

| API | 行为 |
| --- | --- |
| `createJsonRenderer(options)` | 创建独立会话，由调用者负责 `dispose()` |
| `useJsonRenderer(options)` | 在同步 setup 中创建会话，自动绑定页面/组件卸载清理 |
| `state` | 唯一的响应式业务状态；通过 `setState` 更新，避免绕过路径和 props 校验 |
| `spec` / `tree` | 当前完整描述和求值后的节点树，均为 ref；通过方法更新描述 |
| `error` / `pending` | 最近的适配错误和执行中的 `节点ID:动作名` 列表 |
| `dispatch(event)` | 输入回写及动作调度，返回 `Promise<boolean>`；忽略已移除/不可见节点和未声明事件，同一节点的同名进行中动作去重 |
| `setState(path, value)` | 写入现有 JSON Pointer 路径，校验可序列化值与当前可见 props，不存在或非法路径抛错 |
| `load(spec, nextState?)` | 校验后替换描述；取消旧动作与流，不传第二参则保留业务状态；失败保留旧界面并返回 false |
| `createStream(initialSpec?)` | 开始新流，旧流失效；可用完整初始描述重播 UI，同时保留状态和进行中的业务动作 |
| `stream.push(text, done?)` | 应用字符串分块，返回是否提交了完整新描述；部分行/暂缺引用返回 false，错误记录到 `error` |
| `stream.dispose()` / `dispose()` | 停止当前流 / 清理会话，重复调用安全 |

异步动作通过 `context.setState` 提交结果，重置或卸载后的旧上下文不会写入新会话。`context.isActive()` 可判断是否仍有效；用 `context.onCleanup(fn)` 注册计时器、请求等资源的清理函数，动作结束、会话重置或卸载时执行一次。清理函数应同时让已取消的异步等待结束。本包不假设宿主存在 AbortController，不接管网络传输。

## 协议与边界

- 基础组件：`Stack`、`Card`、`Text`、`Input`、`Button`，可扩展目录和自定义组件。
- 属性表达式：`$state`；声明过绑定的顶层属性可使用 `$bindState`。不接受任意函数或动态代码。
- 可见性：布尔值，或 `$state` 配合 `eq`、`not: true`。
- 事件：`on[event] = { action, params? }`；参数支持 `$state`。
- 流式协议：JSONL 的 `add`、`replace`、`remove`，仅允许 `/root` 和 `/elements`。先挂引用后补节点可暂存，结束时必须形成完整合法树。
- 默认上限：200 个节点、8 层深度、单次待解析缓冲 65536 个字符，通过 `limits` 配置正整数。
- 不支持 repeat、slots 协议字段、watch、computed/cond 指令、action chains 或远程 state patch；未知能力明确拒绝。自定义容器的本地默认插槽不等于支持上游 slots 协议。
- 业务状态独立于 spec，只接受 JSON 数据；JSON Pointer 支持 `~0`/`~1` 转义，拒绝原型链键和不存在的状态路径。
- 在 Core 初始化前将共享 Zod 配置为 `jitless: true`，这是刻意的全局配置副作用；消费项目不要随后重新开启 JIT；消费端直接导入 Zod 自建 schema 时，也应在创建 schema 前执行 `z.config({ jitless: true })`，不依赖打包边界外的实例配置。

## 验证与发布边界

包级单测使用独立的搜索/计数目录，覆盖绑定、动作参数、去重、取消、结构校验和事务化 Patch；tsd 锁定公开类型。售后 demo 仅通过包公开入口消费，并以构建后的隔离执行检查保证没有动态求值尝试。

`apps/wevu-json-render-demo` 与 `e2e/ide/wevu-json-render.runtime.test.ts` 提供 headless/真实 DevTools 的同场景验收，包括自定义订单节点及其事件。simulator 的 `recursiveProps` Node、browser 单测和浏览器回归覆盖对象属性隔离与泛型递归传递。

此包未实现模型调用、真实网络分块解码、其他平台适配或完整上游 renderer 行为，也未执行 npm 发布。
