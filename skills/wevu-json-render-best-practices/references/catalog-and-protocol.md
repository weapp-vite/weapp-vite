# Catalog、Spec 与协议

## 最小目录

```ts
import { defineRendererCatalog, standardComponents } from '@wevu/json-render'
import { z } from 'zod'

z.config({ jitless: true })

export const catalog = defineRendererCatalog({
  components: {
    ...standardComponents,
    Counter: {
      props: z.object({ value: z.number() }).strict(),
      events: ['increase'],
    },
  },
  actions: {
    increase: z.object({ step: z.number() }).strict(),
  },
})
```

- 组件名、事件名、动作名和 `bindings` 是静态契约；未知名称应在校验阶段失败。
- props schema 校验表达式求值后的值；动作参数执行前校验。未填写的表单可以先渲染，不必为动作 schema 放宽 props schema。
- 自定义容器设置 `container: true`，由业务组件模板提供默认 `<slot />`；这不等于支持上游 slots 协议。

## 最小 Spec

```ts
import type { CatalogSpec } from '@wevu/json-render'

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
```

| 字段 | 可接受形式 | 注意事项 |
| --- | --- | --- |
| `props` | JSON 值、`{ $state: '/path' }`、声明绑定的 `{ $bindState: '/path' }` | 函数、动态代码和未声明绑定拒绝 |
| `visible` | `boolean` 或 `{ $state, eq?, not? }` | 只支持布尔/状态比较，不支持任意表达式 |
| `on` | `{ [event]: { action, params? } }` | 参数值可引用状态；事件名必须存在于 catalog |
| `children` | spec 元素 ID 数组 | 节点引用最终必须形成完整合法树 |
| `root` | 元素 ID | 必须指向现有节点 |

## 状态路径与输入

`setState(path, value)` 只写现有 JSON Pointer 路径：

- 支持 `~0` / `~1` 转义。
- 拒绝原型链键、不存在路径和不可序列化值。
- 输入事件通过 catalog `bindings` 找到 `$bindState` 目标，不要求业务组件自己改状态。

## 限制与未知能力

默认 `maxNodes: 200`、`maxDepth: 8`、`maxBufferedCharacters: 65536`。`limits` 只接受正整数，不用关闭限制来掩盖异常输入。

明确拒绝：repeat、watch、computed/cond、action chains、远程 state patch 和上游 slots 字段。遇到这些需求先确认是否能改成本地静态结构或业务状态，不静默忽略。
