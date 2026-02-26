---
title: Store API
description: 本页严格对应 wevu/store 的公开导出，包含 defineStore、createStore、storeToRefs 及相关类型。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - store
---

# Store API（状态管理）

以下条目来源于 `packages/wevu/src/store/index.ts` 的公开导出。

## 核心函数

### `defineStore()` {#definestore}

- 类型入口：`DefineStoreOptions`
- 用途：定义 store（setup 风格或 option 风格）。

### `createStore()` {#createstore}

- 类型入口：`StoreManager`
- 用途：创建 store 管理器（可用于作用域隔离和测试隔离）。

### `storeToRefs()` {#storetorefs}

- 类型入口：`StoreToRefsResult`
- 用途：将 store 状态转换为 refs，避免解构丢失响应性。

## Store 类型

### `StoreManager` {#storemanager}

- 用途：store 根管理器类型。

### `DefineStoreOptions` {#definestoreoptions}

- 用途：定义 option 风格 store 的类型约束。

### `StoreToRefsResult` {#storetorefsresult}

- 用途：`storeToRefs()` 返回结果类型。

### `ActionContext` {#actioncontext}

- 用途：`$onAction` 回调上下文。

### `ActionSubscriber` {#actionsubscriber}

- 用途：action 订阅回调签名。

### `SubscriptionCallback` {#subscriptioncallback}

- 用途：状态变更订阅回调签名。

### `StoreSubscribeOptions` {#storesubscribeoptions}

- 用途：`$subscribe` 的订阅选项类型。

### `MutationType` {#mutationtype}

- 用途：store mutation 类型（`'patch object' | 'patch function' | 'direct'`）。

## 示例

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { computed, createStore, defineStore, ref, storeToRefs } from 'wevu'

const storeManager = createStore()

const useCartStore = defineStore('cart', () => {
  const count = ref(0)
  const total = computed(() => count.value * 99)

  function addOne() {
    count.value += 1
  }

  return { count, total, addOne }
})

const cart = useCartStore(storeManager)
const { count, total } = storeToRefs(cart)
</script>

<template>
  <view>count: {{ count }} / total: {{ total }}</view>
  <button @tap="cart.addOne">
    +1
  </button>
</template>
```

```vue [JavaScript]
<script setup>
import { computed, createStore, defineStore, ref, storeToRefs } from 'wevu'

const storeManager = createStore()

const useCartStore = defineStore('cart', () => {
  const count = ref(0)
  const total = computed(() => count.value * 99)

  function addOne() {
    count.value += 1
  }

  return { count, total, addOne }
})

const cart = useCartStore(storeManager)
const { count, total } = storeToRefs(cart)
</script>

<template>
  <view>count: {{ count }} / total: {{ total }}</view>
  <button @tap="cart.addOne">
    +1
  </button>
</template>
```

:::
