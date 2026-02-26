---
title: Store API
description: wevu 的 store 设计接近 Pinia：defineStore 定义，createStore 创建管理器，storeToRefs 安全解构。
keywords:
  - wevu
  - Vue SFC
  - 调试
  - api
  - reference
  - store
  - 的
  - 设计接近
---

# Store API（状态管理）

`wevu` 的 store 设计接近 Pinia：`defineStore` 定义，`createStore` 创建管理器，`storeToRefs` 安全解构。

## 1. 核心函数 {#store-core}

| API           | 类型入口             | 说明                                    |
| ------------- | -------------------- | --------------------------------------- |
| `defineStore` | `DefineStoreOptions` | 定义 store（setup/option 两种风格）。   |
| `createStore` | `StoreManager`       | 创建 store 管理器（插件、作用域隔离）。 |
| `storeToRefs` | `ToRefs`             | 将 store 状态安全转换为 ref。           |

## 2. 常用类型 {#store-types}

| 类型                   | 链接                   | 用途                     |
| ---------------------- | ---------------------- | ------------------------ |
| `StoreManager`         | `StoreManager`         | store 根管理器。         |
| `DefineStoreOptions`   | `DefineStoreOptions`   | 选项式 store 定义类型。  |
| `ActionSubscriber`     | `ActionSubscriber`     | action 订阅回调签名。    |
| `SubscriptionCallback` | `SubscriptionCallback` | 状态变更订阅回调。       |
| `MutationRecord`       | `MutationRecord`       | mutation 记录结构。      |
| `MutationKind`         | `MutationKind`         | mutation 大类。          |
| `MutationType`         | `MutationType`         | mutation 类型枚举。      |
| `MutationOp`           | `MutationOp`           | mutation 操作类型。      |
| `WevuPlugin`           | `WevuPlugin`           | store/runtime 插件类型。 |

## 3. 端到端示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { computed, createStore, defineStore, ref, storeToRefs } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
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

## 4. 调试建议 {#store-debug}

- 如果要统计状态变化路径，可结合 `addMutationRecorder` / `removeMutationRecorder`。
- 如果要确认 `setData` 最终快照，可配合 `SetDataSnapshotOptions` 和运行时调试日志。

## 5. 相关页

- 响应式 API：[/wevu/api/reactivity](/wevu/api/reactivity)
- 运行时桥接 API：[/wevu/api/runtime-bridge](/wevu/api/runtime-bridge)
