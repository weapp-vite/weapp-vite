---
title: 状态管理
description: 什么时候该上 store、什么时候页面本地状态就够了、store 怎么组织。
keywords:
  - handbook
  - wevu
  - store
  - 状态管理
---

# 状态管理

新手最容易在两个极端之间摇摆：什么都放页面本地 state，或者什么都塞进全局 store。

更合理的做法是先问一个问题：这份状态服务谁？

## 什么时候用页面本地状态

只服务当前页面的状态，放页面里就好：

- 当前弹窗是否打开
- 当前输入框内容
- 当前页的 loading

## 什么时候上 store

跨页面共享的状态才需要 store：

- 用户登录态
- 购物车
- 当前门店信息
- 全局主题

## 怎么写一个 store

wevu 的 store 用法和 Pinia 很像。推荐 setup 风格：

```ts
// stores/user.ts
import { defineStore, ref } from 'wevu'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)

  function setToken(value: string | null) {
    token.value = value
  }

  function clearUser() {
    token.value = null
    profile.value = null
  }

  return { token, profile, setToken, clearUser }
})
```

页面里用：

```vue
<script setup lang="ts">
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()
</script>

<template>
  <text>{{ userStore.profile?.nickname || '游客' }}</text>
</template>
```

## 按业务域拆 store

不要做一个超级大 store。按业务域拆：

```txt
stores/
├─ user.ts
├─ cart.ts
├─ order.ts
└─ location.ts
```

## store 和 service 的边界

一个清晰的分工：

- `service` — 负责请求和平台交互
- `store` — 负责状态组织和业务编排
- `page` — 负责展示和触发动作

```ts
// services/order.ts — 只管请求
export function getOrderList() {
  return request({ url: '/api/orders' })
}

// stores/order.ts — 管状态
export const useOrderStore = defineStore('order', () => {
  const list = ref([])
  async function fetchList() {
    list.value = await getOrderList()
  }
  return { list, fetchList }
})
```

```vue
<!-- 页面只管展示和触发 -->
<script setup lang="ts">
const orderStore = useOrderStore()
</script>
```

## storeToRefs

从 store 解构状态的时候，直接解构会丢失响应性。用 `storeToRefs`：

```ts
import { storeToRefs } from 'wevu'

const store = useCartStore()
const { count, totalPrice } = storeToRefs(store)
// count 和 totalPrice 仍然是响应式的
```

方法不需要 `storeToRefs`，直接解构就行：

```ts
const { addItem, removeItem } = store
```

## store 还提供什么

每个 store 实例还有这些方法：

- `$patch(patch)` — 批量更新状态
- `$reset()` — 重置到初始状态
- `$subscribe(callback)` — 监听状态变化
- `$onAction(callback)` — 监听 action 调用

日常开发里 `$patch` 和 `$subscribe` 用得比较多。

## 不要过早引入 store

如果项目还小，不要为了"看起来先进"就把每个页面都硬塞进 store。先问自己：

- 这个状态真的跨页面吗？
- 未来会被多处消费吗？
- 值得被长期缓存吗？

都不是的话，页面本地状态更简单。

## 接下来

- [表单和双向绑定](/handbook/wevu/bind-model)
- [页面跳转](/handbook/navigation)
