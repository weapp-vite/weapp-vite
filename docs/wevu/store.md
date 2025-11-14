# Store（wevu 状态管理）

wevu 提供了轻量的状态管理适配（API 接近 Pinia，但以 wevu/store 导入以避免混淆）。

安装与初始化

```ts
// app.ts（可选）
import { createApp } from 'wevu'
import { createStore } from 'wevu/store'

export const store = createStore()
createApp(() => ({}))
```

定义 Store（仅支持 Setup Store）

```ts
import { computed, ref } from 'wevu'
import { defineStore } from 'wevu/store'

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
import { defineComponent } from 'wevu'
import { storeToRefs } from 'wevu/store'
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
