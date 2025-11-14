# 依赖注入（provide / inject）

用途

- 跨层级传递依赖，减少 props 深度透传；语义与用法与 Vue 一致。

示例

```ts
// 父级
import { defineComponent, provide, readonly, ref } from 'wevu'

defineComponent(() => {
  const count = ref(0)
  const increment = () => {
    count.value++
  }
  provide('count', readonly(count))
  provide('increment', increment)
})
```

```ts
// 深层子级
import { defineComponent, inject } from 'wevu'

defineComponent(() => {
  const count = inject('count')
  const increment = inject('increment')
  return { count, increment }
})
```

注意事项

- 时序要求：`provide` 必须先于 `inject` 执行；在页面 `setup()` 中 `provide` 可能晚于子组件，若依赖顺序建议使用“页面组件”。
- 存储模型：受小程序限制无法遍历组件树，wevu 的注入存储在全局仓库；请确保 key 全局唯一，建议使用 `Symbol`。
