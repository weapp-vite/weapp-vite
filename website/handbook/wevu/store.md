---
title: Store：状态怎么放更合理
description: 解释什么时候该上 store、什么时候局部 state 就够用，以及在 Wevu 项目里如何按业务域组织状态、请求和页面编排。
keywords:
  - handbook
  - wevu
  - store
  - 状态管理
---

# Store：状态怎么放更合理

新用户一开始很容易在两个极端之间摇摆：

- 什么都放页面本地 state
- 什么都放全局 store

更合理的方式是先判断：这份状态到底服务谁。

## 一个很好用的判断标准

### 只服务当前页面

优先放页面局部 state。

例如：

- 当前弹窗是否打开
- 当前输入框内容
- 当前页的 loading

### 跨页面复用或跨模块共享

再考虑放 store。

例如：

- 用户登录态
- 购物车数量
- 当前门店信息
- 全局主题或实验开关

## 一个很典型的 store 例子

```ts
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

  return {
    token,
    profile,
    setToken,
    clearUser,
  }
})
```

这个例子就很适合 store，因为用户态显然不是只服务一个页面。

## 页面里怎么消费 store

```vue
<script setup lang="ts">
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()
</script>

<template>
  <view>
    <text>{{ userStore.profile?.nickname || "游客" }}</text>
  </view>
</template>
```

## 一个经常被忽略的原则

store 不等于“大杂烩”。

建议按业务域拆，而不是做成一个超级仓库：

```txt
stores/
├─ user.ts
├─ cart.ts
├─ order.ts
└─ location.ts
```

这样会比：

```txt
stores/global.ts
```

更容易长期维护。

## store 和 service 的边界

一个很稳的划分方式是：

- `service`
  负责请求和平台交互
- `store`
  负责状态组织和业务编排
- `page`
  负责展示和触发动作

例如：

```ts
// services/order.ts
export function getOrderList() {
  return request({ url: '/api/orders' })
}
```

```ts
// stores/order.ts
export const useOrderStore = defineStore('order', () => {
  const list = ref([])

  async function fetchList() {
    list.value = await getOrderList()
  }

  return { list, fetchList }
})
```

```vue
<script setup lang="ts">
const orderStore = useOrderStore()
</script>
```

## 不一定一开始就要上很多 store

这是非常重要的一点。
如果项目还小，不要为了“看起来先进”而把每个页面都硬塞进 store。

先问自己：

- 这个状态真的跨页面吗？
- 这个状态未来会被多处消费吗？
- 这个状态值得被长期缓存吗？

如果答案都是否，那局部 state 往往更简单。

## 一句话总结

store 是为“共享状态”和“跨页面业务编排”服务的，不是为了替代页面本地状态。

接下来建议继续看：

- [bindModel：双向绑定方案](/handbook/wevu/bind-model)
- [插件与全局能力](/handbook/wevu/plugins)
