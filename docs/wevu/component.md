# 定义组件（defineComponent）

`defineComponent()` 是原生 `Component()` 的超集：在 `attached` 阶段调用同步 `setup()`；返回对象会合并到组件实例，模板可直接使用。

基础示例（需手动挂载）

```ts
import { computed, defineComponent, reactive, watchEffect } from 'wevu'

const Comp = defineComponent({
  properties: { count: Number },
  setup(props) {
    const state = reactive({ double: computed(() => props.count * 2) })
    watchEffect(() => console.log('count:', props.count))
    return { state }
  }
})
// 手动挂载，才真正调用原生 Component()
Comp.mount()
```

要点

- `props` 是响应式对象，不要在 `setup()` 形参处解构（会丢失响应性）。
- 顺序：组件 `setup()` 按组件树自顶向下执行，可能早于“页面”的 `setup()`；如需基于 `props` 派生状态，使用 `computed`/`watchEffect`。
- `this` 在 `setup()` 中不可用；`setup(props, context)` 可获取 `id/dataset/exitState/triggerEvent` 等。
- 生命周期在 `setup()` 内以 `onReady/onMove/onDetach/...` 注册；在页面销毁时侦听器与计算值会自动清理。

访问实例（替代 this）

```ts
import { defineComponent, getCurrentInstance } from 'wevu'

const C = defineComponent({
  setup() {
    const comp = getCurrentInstance() // 等价于原生组件实例
    // comp?.setData?.({ /* ... */ }) // 谨慎使用
    return {}
  }
})
C.mount()
```

多组件定义，单次挂载

- 背景：原生 `Component()` 是构造函数，同一文件多次调用会报错。
- wevu 的做法：`defineComponent()` 返回“可挂载实例”，真正注册在 `.mount()` 时发生。你可以在同一文件定义多个组件，但只对导出的那个调用 `.mount()`：

```ts
const Primary = defineComponent(() => ({ /* ... */ }))
const Secondary = defineComponent(() => ({ /* ... */ }))
// 仅挂载一个，避免触发原生多次 Component() 的限制
Primary.mount()
```
