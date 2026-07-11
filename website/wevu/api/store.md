---
title: Store API
description: 本页覆盖 wevu/store 的入口函数、Store 实例 API、Manager、Options Store 配置及公开类型。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - store
---

# Store API（状态管理）

以下条目来源于 `packages-runtime/wevu/src/store/index.ts` 的模块导出，以及 `defineStore()` 返回实例和 `createStore()` 返回 Manager 的公共契约。

> Wevu Store 对齐 Pinia 的主要使用心智，但不是 Pinia 的完整实现。`createStore()`、Manager 安装行为、订阅时机和小程序响应式更新均以本页契约为准。

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

## Store 实例 API

### `$id` {#store-id}

- 用途：读取 `defineStore()` 声明的 Store 标识。
- 适用：Setup Store 与 Options Store。

### `$state` {#store-state}

- 用途：读取或浅合并替换 Options Store 的响应式 state。
- 适用：仅 Options Store 的公共类型包含 `$state`；Setup Store 应直接使用 setup 返回的 state/ref。

### `$patch()` {#store-patch}

- 用途：通过部分对象或回调函数批量修改状态。
- 订阅类型：分别触发 `patch object` 或 `patch function`。

### `$reset()` {#store-reset}

- 用途：恢复 Store 创建时保存的初始状态快照。
- 适用：Setup Store 与 Options Store；Setup Store 中不可写的 computed/readonly ref 会被跳过。

### `$subscribe()` {#store-subscribe}

- 用途：订阅 Store 状态变化，回调接收 mutation 信息和当前状态。
- 返回值：取消订阅函数。
- 选项：支持 `{ detached: true }`，用于跨页面生命周期保留订阅。

### `$onAction()` {#store-onaction}

- 用途：订阅 Action 调用，可通过 `after()` 和 `onError()` 监听成功结果或错误。
- 返回值：取消订阅函数。

## Store Manager API

### `manager.install()` {#storemanager-install}

- 用途：保留与插件安装心智一致的接口。
- 差异：小程序环境不需要注册全局插件入口，当前实现不执行额外逻辑。

### `manager.use()` {#storemanager-use}

- 用途：注册 Store 插件；每个新建 Store 会调用插件并传入 `{ store }`。
- 返回值：当前 `StoreManager`，支持链式调用。

## Options Store 配置

### `state` {#options-state}

- 类型：`() => Record<string, any>`。
- 用途：返回每个 Store 的初始响应式状态。

### `getters` {#options-getters}

- 用途：声明派生状态；getter 可接收 state，并可通过 `this` 访问 state、其他 getters 和 actions。

### `actions` {#options-actions}

- 用途：声明 Store 方法；Action 内的 `this` 指向 Store 实例，并会触发 `$onAction()` 订阅。

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
