# Store（wevu 状态管理）

wevu 提供了轻量的状态管理适配（API 接近 Pinia，直接从 wevu 主入口导入）。

安装与初始化

```ts
// app.ts（可选）
import { createApp, createStore } from 'wevu'

export const store = createStore()
createApp(() => ({}))
```

定义 Store（仅支持 Setup Store）

```ts
import { computed, defineStore, ref } from 'wevu'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  const increment = () => {
    count.value++
  }
  return { count, double, increment }
})
```

在组件中使用

```ts
import { defineComponent, storeToRefs } from 'wevu'
import { useCounter } from './store'

defineComponent(() => {
  const store = useCounter()
  const { count, double } = storeToRefs(store) // 保持响应性
  const { increment } = store
  return { count, double, increment }
})
```

提示

- 仅支持 Setup Store；如需 `$reset` 可自行实现。
- 不要将整个 `store` 直接暴露给模板；应使用 `storeToRefs()` 拆解以保持响应性。
- 适配也支持简单插件（通过 `createStore().use(plugin)`），但默认无需显式安装即可直接使用。

限制与差异（相对 Pinia）

- `$subscribe` 触发时机：当前仅在调用 `$patch()` 或直接给 `$state` 赋值时触发；对单个属性的“直接赋值”（如 `store.count++`）不会触发订阅。若需要订阅，请使用 `$patch()` 或在组件内用 `watch()` 监听具体字段。
- `$reset` 仅对 Options Store 提供；Setup Store 无 `$reset`（如需恢复初始值请手写一个动作）。
- SSR/HMR/Devtools：wevu 面向小程序运行环境，未提供这些 Web 专属能力。
