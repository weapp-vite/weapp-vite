---
title: Store（状态管理）
description: Store（状态管理），聚焦 Wevu / store 相关场景，覆盖 Weapp-vite 与 Wevu 的能力、配置和实践要点。
keywords:
  - Wevu
  - api
  - store
  - Store（状态管理）
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# Store（状态管理）

Wevu 内置了类 Pinia 的 Store：

- 用 `defineStore()` 定义 Store
- 用 `useXxx()` 获取**单例**实例
- 用 `storeToRefs()` 解构 state/getter，避免丢失响应式

Store 适合客户端状态；服务端列表、详情、请求缓存和跨页刷新使用独立的 [`@wevu/query`](#server-state-query)。它不依赖 Pinia，也不改变现有 Store API。

:::tip 导入约定
内置 Store API 从 `wevu` 主入口导入；服务端查询 API 从 `@wevu/query` 导入；`wevu/compiler` 仅供 Weapp-vite 等编译侧工具使用（非稳定用户 API）。
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

## 持久化（storage）与初始化顺序

Store 是单例，适合承载登录态、用户偏好、缓存索引等“跨页面共享”的状态。常见诉求是把部分 state 持久化到本地存储（`wx.setStorageSync` / `wx.setStorage`）。

推荐做法：

- 只持久化必要字段（避免把大对象/列表直接塞进 storage）
- 统一在插件中处理（避免每个 store 手写重复逻辑）
- 注意初始化顺序：在第一次 `useXxx()` 之前完成“读取 → 回填”

示例（简化版，仅展示形态）：

```ts
import { createStore, defineStore } from 'wevu'

const manager = createStore()
manager.use(({ store }) => {
  const key = `wevu:${store.$id}`
  try {
    const raw = wx.getStorageSync(key)
    if (raw) {
      store.$patch(JSON.parse(raw))
    }
  }
  catch {}

  store.$subscribe((_mutation, state) => {
    try {
      wx.setStorageSync(key, JSON.stringify(state))
    }
    catch {}
  })
})

export const usePrefs = defineStore('prefs', {
  state: () => ({ theme: 'light' as 'light' | 'dark' }),
})
```

:::warning 注意
上面示例直接读取/写入 `wx` 存储，必须在小程序运行时执行；如果你在 Node/Vitest 环境跑测试，需要 stub `wx` 或把持久化逻辑封装到可替换的 adapter。
:::

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
- SSR/HMR/Devtools：Wevu 面向小程序运行环境，暂未提供这些 Web 专属能力。

## 常见问题

- 内置 Store API 从 `wevu` 主入口导入。
- 不需要为了使用 store 先调用 `createStore()`；仅在使用插件时才需要。

## 服务端状态查询：`@wevu/query` {#server-state-query}

`@wevu/query` 是独立的 Wevu 查询包，不是 Pinia Colada 的别名或完整兼容实现。一个 `QueryClient` 管理一份内存缓存；同键请求共享进行中的 Promise，页面分别持有自己的观察者。

在 `app.vue` 的 setup 中安装插件，并显式接入微信宿主：

```vue
<script setup lang="ts">
import { createQueryClient, createQueryPlugin, createWechatQueryHost } from '@wevu/query'
import { use } from 'wevu'

const queryClient = createQueryClient()
use(createQueryPlugin(queryClient, {
  host: createWechatQueryHost(wx),
}))
</script>
```

- `defineQueryOptions()`：保留查询键与返回数据的类型关联，供 `fetchQuery()`、`getQueryData()` 和 `setQueryData()` 共享。
- `useQuery()`：返回逐字段只读 computed，如 `data`、`error`、`status` 和 `fetchStatus`；`refresh()` 复用新鲜缓存，`refetch()` 强制重新请求。`select` 失败只改变当前观察者的错误状态，不污染原始缓存。
- `useMutation()` / `createMutation()`：执行服务端变更，并通过 `onSuccess` 等回调更新或失效关联查询。
- `useInfiniteQuery()` / `observeInfiniteQuery()`：在同一缓存内维护 `pages` 与 `pageParams`，通过 `fetchNextPage()` 追加下一页；失效后的重新查询从初始页开始。
- `queryClient.invalidateQueries({ key: ['orders'] })`：按键前缀失效关联数据。页面隐藏时不自动刷新，返回页面后再按新鲜度刷新；隐藏本身不会取消其他页面仍在共享的请求。
- `queryClient.setScope(accountId)`：切换账号或租户时清空并撤销旧作用域结果。`clear()` 与作用域切换都会重置现有观察者，**不会自动重跑旧配置，之后的页面显示事件也不会触发重跑**；业务需显式 `refresh()` / `invalidateQueries()`，或更新查询键、重新启用查询。`clear()` 后仍可复用，`dispose()` 是终止操作，之后不能再发起查询或 mutation。

`query({ key, signal })` 由业务提供真实请求。使用 `wx.request` 时，应将 `signal` 绑定到返回的 `RequestTask.abort()`，并在请求结束时移除监听；请求取消与旧结果隔离由查询核心协调，不要求业务依赖浏览器 `fetch`。

默认 `staleTime` 为 5 秒、`gcTime` 为 5 分钟，可在 client 或查询选项中覆盖。同一缓存条目的多个使用者以最长 `gcTime` 保留数据。离线的显式查询会等待恢复；最后一个观察者销毁后，其观察者拥有的排队请求会取消。

缓存只保存在内存中，不内置持久化、失败重试策略或乐观更新。作用域撤销会屏蔽旧 mutation 的结果和回调，但不能撤销已经发送到服务端的写入。

真实 `wx.request` 与“列表 → 详情变更 → 返回刷新”示例位于仓库 `e2e-apps/wevu-features/src/shared/queryFixture.ts` 和 `src/pages/query-list`、`src/pages/query-detail`；业务源码不区分 DevTools 与 headless provider。该回归 fixture **故意不转发 `signal`**，用于证明底层请求忽略取消、旧响应仍然返回时不会覆盖当前查询结果；生产请求仍应按上文接入 `RequestTask.abort()`。
