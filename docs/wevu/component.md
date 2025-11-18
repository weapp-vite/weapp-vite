# 定义组件（defineComponent）

`defineComponent()` 是原生 `Component()` 的超集：在 `attached` 阶段调用同步 `setup()`；返回对象会合并到组件实例，模板可直接使用。

基础示例

```ts
import { computed, defineComponent, reactive, watchEffect } from 'wevu'

defineComponent({
  properties: { count: Number },
  setup(props) {
    const state = reactive({ double: computed(() => props.count * 2) })
    watchEffect(() => console.log('count:', props.count))
    return { state }
  }
})
```

要点

- `props` 是响应式对象，不要在 `setup()` 形参处解构（会丢失响应性）。
- 顺序：组件 `setup()` 按组件树自顶向下执行，可能早于“页面”的 `setup()`；如需基于 `props` 派生状态，使用 `computed`/`watchEffect`。
- `this` 在 `setup()` 中不可用；`setup(props, context)` 可获取 `id/dataset/exitState/triggerEvent` 等。
- 生命周期在 `setup()` 内以 `onReady/onMove/onDetach/...` 注册；在页面销毁时侦听器与计算值会自动清理。

访问实例（替代 this）

```ts
import { defineComponent, getCurrentInstance } from 'wevu'

defineComponent({
  setup() {
    const comp = getCurrentInstance() // 等价于原生组件实例
    // comp?.setData?.({ /* ... */ }) // 谨慎使用
    return {}
  }
})
```

自动注册与 `.mount()`

- `defineComponent()` 执行时会立即注册原生 `Component()`；`.mount()` 仅保留 API 对称性，为空操作，可忽略。
- 同一文件多次调用 `defineComponent()` 仍会触发原生“重复 Component()`”限制。建议每个组件独立成文件，或在调用前自行控制条件。
