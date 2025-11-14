# Pinia（wevu 适配）

Pinia 是 Vue 官方的状态管理库。wevu 提供了适配以便在小程序中直接使用相同的 API（以 wevu 的导入路径为准）。

安装与初始化

```ts
// app.ts
import { createApp } from 'wevu'

// pinia.ts
import { createPinia } from 'wevu/pinia'

export const pinia = createPinia()
createApp(() => ({}))
```

定义 Store（仅支持 Setup Store）

```ts
import { computed, ref } from 'wevu'
import { defineStore } from 'wevu/pinia'

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
import { storeToRefs } from 'wevu/pinia'
import { useCounter } from './store'

defineComponent(() => {
  const store = useCounter()
  const { count, double } = storeToRefs(store) // 保持响应性
  const { increment } = store
  return { count, double, increment }
})
```

提示

- 仅支持 Setup Store；如需 `$reset` 可自行实现（对 Option Store 专属的 `$reset` 不适用）。
- 不要将整个 `store` 直接暴露给模板；应使用 `storeToRefs()` 拆解以保持响应性。
- 适配同样支持 Pinia 插件（如状态持久化插件）。
