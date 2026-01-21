# Pinia 使用要点（官方总结稿）

本文梳理自 Pinia 官方文档（pinia.vuejs.org），聚焦“如何写、如何用、常见坑与进阶”。在 wevu 项目中你可用 wevu 主入口提供的同形 API 做轻量状态管理；如已熟悉 Pinia，迁移成本极低。

核心概念

- Store 是有命名空间的“状态容器”，通过 `defineStore(id, options | setup)` 定义。
- 两种写法
  - Options Store：对象式，包含 `state/getters/actions` 三块。
  - Setup Store：函数式，在内部用 `ref/reactive/computed` 组织，最后 `return` 需要暴露的状态与方法（推荐）。
- Store 是单例（相对于一个 Pinia 实例来说），在组件中通过 `useXxx()` 获取同一个实例。

安装与创建

```ts
import { createPinia } from 'pinia'
// 典型 Vue Web 项目
import { createApp } from 'vue'

createApp(App).use(createPinia()).mount('#app')
```

在 wevu 中，推荐直接使用主入口的 Store API，避免额外安装/注册，且无需在应用上 `use()`：

```ts
import { defineStore } from 'wevu'
```

定义 Store

Options Store

```ts
import { defineStore } from 'pinia'

export const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    double: state => state.count * 2,
  },
  actions: {
    increment() {
      this.count++
    },
  },
})
```

Setup Store（推荐）

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  return { count, double, increment }
})
```

在组件/页面中使用

```ts
import { storeToRefs } from 'pinia'
import { useCounter } from '@/stores/counter'

const counter = useCounter()
// 解构 state/getters 请用 storeToRefs 保持响应性
const { count, double } = storeToRefs(counter)
// actions 可直接解构
const { increment } = counter
```

状态修改与批量更新

- 直接赋值：`this.count++`、`count.value++`
- 批量补丁：`store.$patch({ count: 100 })` 或 `store.$patch((state) => { state.items.push(...) })`
- 重置：`store.$reset()`（Setup Store 与 Options Store 均可用）
- 直接替换整树：`store.$state = { ... }`

订阅与动作钩子

- 订阅状态变更：`store.$subscribe((mutation, state) => { ... })`
  - `mutation.type`: `'direct' | 'patch object' | 'patch function'`
  - 可在组件卸载后继续：`{ detached: true }`
- 订阅动作：`store.$onAction(({ name, store, args, after, onError }) => { ... })`
  - 可在 `after()` 和 `onError()` 中拿到动作完成/失败回调

插件机制

```ts
import { createPinia } from 'pinia'

const pinia = createPinia()
pinia.use(({ store }) => {
  // 扩展 store 实例：store.xxx = ...
})
```

- 常见用途：持久化（如 pinia-plugin-persistedstate）、加密、日志
- 在 wevu 中可参考 `createStore().use()` 进行轻量扩展。

SSR 与 Hydration（Web）

- SSR 时每个请求独立的 Pinia 实例；将服务端的 `store.$state` 注入到客户端进行 hydration。

Devtools 与 HMR（Web）

- 支持 Vue Devtools 的时间旅行与调试；支持 Vite HMR 热替换 Store。

类型与最佳实践

- `defineStore` 会推断 `state/getters/actions` 的类型，`storeToRefs(store)` 可正确推导 Ref 类型。
- 不要直接解构 store（会失去响应性）；应使用 `storeToRefs()`。
- Store 在 `setup()` 中创建和使用；避免在模块顶层对 `useStore()` 解构并导出（会与实例绑定错误）。
