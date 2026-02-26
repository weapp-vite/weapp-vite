---
title: Reactivity API
description: 本页覆盖 Wevu 响应式层的全部公开函数，包括“业务常用”和“调试/底层”两类。
keywords:
  - Wevu
  - Vue SFC
  - 调试
  - api
  - reference
  - reactivity
  - 本页覆盖
  - 响应式层的全部公开函数
---

# Reactivity API（响应式与调度）

本页覆盖 `wevu` 响应式层的全部公开函数，包括“业务常用”和“调试/底层”两类。

## 1. 状态创建与派生

| API               | 类型入口                              | 说明                        |
| ----------------- | ------------------------------------- | --------------------------- |
| `ref`             | `Ref`                                 | 创建基础响应式引用。        |
| `reactive`        | `object`                              | 创建深层响应式对象。        |
| `shallowRef`      | `ShallowRef`                          | 只追踪 `.value` 变更。      |
| `shallowReactive` | `object`                              | 仅顶层属性响应式。          |
| `readonly`        | `Readonly<T>`                         | 只读代理。                  |
| `computed`        | `ComputedRef` / `WritableComputedRef` | 声明计算属性（只读/可写）。 |

## 2. 监听与副作用

| API               | 类型入口                           | 说明                       |
| ----------------- | ---------------------------------- | -------------------------- |
| `watch`           | `WatchOptions` / `WatchStopHandle` | 侦听 source 变化。         |
| `watchEffect`     | `WatchStopHandle`                  | 自动收集依赖并执行副作用。 |
| `effect`          | `WatchStopHandle`                  | 底层副作用 API。           |
| `effectScope`     | `EffectScope`                      | 作用域级管理 effect。      |
| `getCurrentScope` | `EffectScope`                      | 获取当前 effect scope。    |
| `onScopeDispose`  | `() => void`                       | scope 销毁时回调。         |
| `stop`            | `void`                             | 停止某个 effect/watch。    |

## 3. Ref/Proxy 工具

| API          | 类型入口           | 说明                       |
| ------------ | ------------------ | -------------------------- |
| `toRef`      | `Ref`              | 把对象属性转换为 ref。     |
| `toRefs`     | `ToRefs`           | 批量转换对象属性为 ref。   |
| `unref`      | `T`                | 取 ref.value 或原值。      |
| `toValue`    | `MaybeRefOrGetter` | 统一展开值/Ref/getter。    |
| `triggerRef` | `void`             | 手动触发 shallowRef 更新。 |
| `toRaw`      | `T`                | 获取原始对象。             |
| `markRaw`    | `T`                | 标记对象跳过代理。         |

## 4. 响应式判定

| API                 | 类型入口       | 说明                       |
| ------------------- | -------------- | -------------------------- |
| `isRef`             | type predicate | 判定是否 Ref。             |
| `isReactive`        | type predicate | 判定是否 reactive 代理。   |
| `isShallowRef`      | type predicate | 判定是否 shallowRef。      |
| `isShallowReactive` | type predicate | 判定是否 shallowReactive。 |
| `isRaw`             | `boolean`      | 判定对象是否被 `markRaw`。 |

## 5. 批处理与调度

| API          | 类型入口        | 说明                     |
| ------------ | --------------- | ------------------------ |
| `nextTick`   | `Promise<void>` | 等待当前微任务批次完成。 |
| `batch`      | `() => void`    | 在单次批处理中执行函数。 |
| `startBatch` | `void`          | 手动开始批处理。         |
| `endBatch`   | `void`          | 手动结束批处理。         |

## 6. 调试与底层能力

这组 API 通常用于框架层、性能调试或复杂序列化场景：

| API                    | 类型入口                     | 说明                               |
| ---------------------- | ---------------------------- | ---------------------------------- |
| `prelinkReactiveTree`  | `PrelinkReactiveTreeOptions` | 预链接对象树，优化后续路径追踪。   |
| `touchReactive`        | `void`                       | 手动触发 reactive 树探测。         |
| `traverse`             | `void`                       | 深度遍历依赖收集辅助。             |
| `getReactiveVersion`   | `number`                     | 读取响应式内部版本号。             |
| `getDeepWatchStrategy` | `string`                     | 获取当前深度 watch 策略。          |
| `setDeepWatchStrategy` | `void`                       | 修改深度 watch 策略（测试/调优）。 |

## 7. 组合示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { computed, nextTick, reactive, toRefs, watch, watchEffect } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
const state = reactive({ count: 0, unit: 2 })
const { count } = toRefs(state)
const doubled = computed(() => count.value * state.unit)

watch(count, (n) => {
  console.log('count changed:', n)
})

watchEffect(() => {
  console.log('preview:', doubled.value)
})

async function inc() {
  count.value += 1
  await nextTick()
}
</script>

<template>
  <button @tap="inc">
    count: {{ count }} / doubled: {{ doubled }}
  </button>
</template>
```

```vue [JavaScript]
<script setup>
import { computed, nextTick, reactive, toRefs, watch, watchEffect } from 'wevu'

const state = reactive({ count: 0, unit: 2 })
const { count } = toRefs(state)
const doubled = computed(() => count.value * state.unit)

watch(count, (n) => {
  console.log('count changed:', n)
})

watchEffect(() => {
  console.log('preview:', doubled.value)
})

async function inc() {
  count.value += 1
  await nextTick()
}
</script>

<template>
  <button @tap="inc">
    count: {{ count }} / doubled: {{ doubled }}
  </button>
</template>
```

:::
