---
title: Store（状态管理）
---

# Store（状态管理）

wevu 内置了类 Pinia 的 Store：用 `defineStore()` 定义、用 `useXxx()` 获取**单例**实例、用 `storeToRefs()` 解构保持响应式。

:::tip 导入约定
运行时 API 均从 `wevu` 主入口导入；不支持 `wevu/store` 子路径；`wevu/compiler` 仅供 weapp-vite 等编译侧工具使用（非稳定用户 API）。
:::

## 导入与核心 API

- `defineStore(id, setup | options)`：定义 Store，返回 `useXxx()` 获取单例实例。
- `storeToRefs(store)`：将 state/getter 包装为 `ref`，函数保持原样，解构不丢失响应式。
- `createStore()`：可选的插件入口；只有需要插件时才调用（见下文）。

## Setup Store 示例（推荐）

```ts
// stores/counter.ts
import { computed, defineStore, ref } from 'wevu'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  const inc = () => count.value++
  return { count, doubled, inc }
})
```

特点：

- 你可以返回任意字段；函数会被当作 action（除 `$` 开头的保留字段）。
- `$patch/$subscribe/$onAction` 等基础 API 会自动合并进返回对象。

## Options Store 示例

```ts
// stores/user.ts
import { defineStore } from 'wevu'

export const useUser = defineStore('user', {
  state: () => ({ name: '', age: 0 }),
  getters: {
    label(state) {
      return `${state.name}:${state.age}`
    },
    canVote() {
      return this.age >= 18
    },
  },
  actions: {
    grow() {
      this.age += 1
    },
  },
})
```

## 在页面/组件中使用

```ts
// pages/counter/index.ts
import { defineComponent, storeToRefs } from 'wevu'
import { useCounter } from '@/stores/counter'

export default defineComponent({
  setup() {
    const counter = useCounter()
    const { count, doubled } = storeToRefs(counter)

    counter.$subscribe((mutation) => {
      console.log('[counter]', mutation.type, mutation.storeId)
    })

    return { count, doubled, inc: counter.inc }
  },
})
```

要点：

- Store 是单例，在页面/组件 `setup` 里调用 `useXxx()` 即可复用。
- 解构 state/getter 请使用 `storeToRefs`，actions 可以直接解构。

## 插件与订阅

- 默认无需插件即可使用；只有当你需要统一扩展所有 Store 时再调用 `createStore()` 并注册插件。
- 插件需在第一次 `useXxx()` 之前注册。`createStore()` 会记录为全局单例，之后创建的 Store 会自动应用插件（插件参数为 `{ store }`）。

```ts
import { createStore, defineStore } from 'wevu'

const manager = createStore()
manager.use(({ store }) => {
  store.$onAction((ctx) => {
    ctx.after(res => console.log('[after]', ctx.name, res))
    ctx.onError(err => console.error('[error]', ctx.name, err))
  })
  store.$subscribe((mutation, state) => {
    console.log(`[${store.$id}]`, mutation.type, state)
  })
})

// 之后定义的任何 store 都会自动套用上述插件
export const useCart = defineStore('cart', {
  state: () => ({ items: [] as Array<{ id: string, count: number }> }),
  actions: {
    add(id: string, count = 1) {
      const found = this.items.find(i => i.id === id)
      if (found) {
        found.count += count
      }
      else { this.items.push({ id, count }) }
    },
  },
})
```

## Store 实例 API

- `$id`：当前 Store 的唯一标识。
- `$state`（Options Store）：读取/替换整个 state；赋值会做浅合并并触发 `patch object`。
- `$patch(patch | fn)`：批量修改；Setup/Options Store 均可用，支持对象合并或回调方式。
- `$reset()`（Options Store）：将 state 重置为初始值。
- `$subscribe((mutation, state) => void)`：订阅变更，返回取消订阅函数；`mutation.type` 为 `patch object` 或 `patch function`。
- `$onAction(({ name, store, args, after, onError }) => void)`：订阅 action 调用，支持成功/失败回调。
- `storeToRefs(store)`：将所有非函数字段转换为可写 `ref`，函数保持原样，避免解构丢失响应式。

## TypeScript 与最佳实践

- Setup Store 会自动推导返回对象的类型；Options Store 可通过泛型精确声明 `state/getters/actions`。
- Store 文件按功能域组织（例如 `stores/user.ts`、`stores/cart.ts`），Store ID 使用小写单数。
- 避免直接解构 state：使用 `storeToRefs`；actions 可以直接解构。
- SSR/HMR/Devtools：wevu 面向小程序运行环境，暂未提供这些 Web 专属能力。

## 常见问题

- 不要从 `wevu/store` 导入，所有 API 均在 `wevu` 主入口。
- 不需要为了使用 store 先调用 `createStore()`；仅在使用插件时才需要。
