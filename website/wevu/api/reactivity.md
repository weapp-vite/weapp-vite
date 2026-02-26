---
title: Reactivity API
description: 本页覆盖 Wevu 响应式层的全部公开函数，包括状态创建、监听副作用、工具函数与调度能力。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - Vue SFC
  - api
  - reference
  - reactivity
---

# Reactivity API（响应式与调度）

本页按「一个 API 一个小节」组织，结构参考 Vue 官方 API 文档。每个小节都包含用途、类型入口与使用建议，便于快速定位与深入阅读。

## 状态创建与派生

### `ref()` {#ref}

- 类型入口：`Ref<T>`
- 用途：创建最常用的基础响应式引用，适合原始值或独立状态。
- 说明：读取使用 `ref.value`；在模板中会自动解包。

### `customRef()` {#customref}

- 类型入口：`CustomRefFactory<T>` / `CustomRefOptions<T>`
- 用途：自定义 `track/trigger` 行为。
- 说明：适合防抖输入、手动控制触发时机等高级场景。

### `reactive()` {#reactive}

- 类型入口：`object`
- 用途：创建深层响应式对象，适合聚合状态。
- 说明：对嵌套对象也会做代理；适合表单、复杂页面状态。

### `shallowRef()` {#shallowref}

- 类型入口：`ShallowRef<T>`
- 用途：只追踪 `.value` 本身是否变更，不做深层代理。
- 说明：用于大对象/第三方实例，减少深层响应式开销。

### `shallowReactive()` {#shallowreactive}

- 类型入口：`object`
- 用途：仅顶层属性响应式，内部对象保持原值。
- 说明：常用于“只关心顶层替换”的场景。

### `readonly()` {#readonly}

- 类型入口：`Readonly<T>`
- 用途：创建只读代理，防止误修改。
- 说明：常用于向下游暴露状态快照。

### `computed()` {#computed}

- 类型入口：`ComputedRef<T>` / `WritableComputedRef<T>`
- 用途：声明派生状态，自动缓存并按依赖更新。
- 说明：支持只读与可写两种形式；优先用于“纯函数派生”。

## 监听与副作用

### `watch()` {#watch}

- 类型入口：`WatchOptions` / `WatchStopHandle`
- 用途：侦听 source 变化并执行回调。
- 说明：适合精确观察某个字段、computed 或 getter。

### `watchEffect()` {#watcheffect}

- 类型入口：`WatchStopHandle`
- 用途：自动收集依赖并立即执行副作用。
- 说明：适合快速联动逻辑与调试输出。

### `effect()` {#effect}

- 类型入口：`WatchStopHandle`
- 用途：底层副作用 API，通常框架层/高级场景使用。
- 说明：业务代码优先使用 `watchEffect`。

### `effectScope()` {#effectscope}

- 类型入口：`EffectScope`
- 用途：把一组 effect/watch 放在同一作用域统一管理。
- 说明：在组件外组合逻辑、插件场景很有用。

### `getCurrentScope()` {#getcurrentscope}

- 类型入口：`EffectScope | undefined`
- 用途：获取当前激活的 effect scope。
- 说明：常与 `onScopeDispose` 配合使用。

### `onScopeDispose()` {#onscopedispose}

- 类型入口：`() => void`
- 用途：在 scope 销毁时执行清理逻辑。
- 说明：适合解绑事件、释放资源。

### `stop()` {#stop}

- 类型入口：`void`
- 用途：停止指定 effect/watch。
- 说明：用于手动中断监听链路。

## Ref / Proxy 工具

### `toRef()` {#toref}

- 类型入口：`Ref<T>`
- 用途：把对象某个属性映射为 ref。
- 说明：常用于解构后保持响应式引用。

### `toRefs()` {#torefs}

- 类型入口：`ToRefs<T>`
- 用途：批量把对象属性转换为 ref。
- 说明：适合从 `reactive` 安全解构。

### `unref()` {#unref}

- 类型入口：`T`
- 用途：统一读取 `ref.value` 或普通值。
- 说明：减少“值/Ref 双形态”判断分支。

### `toValue()` {#tovalue}

- 类型入口：`MaybeRefOrGetter<T>`
- 用途：统一展开普通值、Ref 或 getter。
- 说明：编写可复用工具函数时很常见。

### `triggerRef()` {#triggerref}

- 类型入口：`void`
- 用途：手动触发 `shallowRef` 依赖更新。
- 说明：用于“对象内部变更但引用未变”场景。

### `toRaw()` {#toraw}

- 类型入口：`T`
- 用途：拿到代理前的原始对象。
- 说明：调试或与第三方库交互时使用。

### `markRaw()` {#markraw}

- 类型入口：`T`
- 用途：标记对象跳过响应式代理。
- 说明：适用于大型类实例、SDK 对象。

## 响应式判定

### `isRef()` {#isref}

- 类型入口：type predicate
- 用途：判断某值是否为 Ref。

### `isReactive()` {#isreactive}

- 类型入口：type predicate
- 用途：判断对象是否是 `reactive` 代理。

### `isShallowRef()` {#isshallowref}

- 类型入口：type predicate
- 用途：判断是否为 `shallowRef`。

### `isShallowReactive()` {#isshallowreactive}

- 类型入口：type predicate
- 用途：判断是否为 `shallowReactive`。

### `isRaw()` {#israw}

- 类型入口：`boolean`
- 用途：判断对象是否被 `markRaw` 标记。

## 批处理与调度

### `nextTick()` {#nexttick}

- 类型入口：`Promise<void>`
- 用途：等待当前批次响应式更新完成。
- 说明：常用于更新后读取最新渲染状态。

### `batch()` {#batch}

- 类型入口：`() => void`
- 用途：在同一批处理中执行一组状态改动。
- 说明：减少中间态触发的无效计算与更新。

### `startBatch()` {#startbatch}

- 类型入口：`void`
- 用途：手动开启批处理。
- 说明：需要与 `endBatch` 成对调用。

### `endBatch()` {#endbatch}

- 类型入口：`void`
- 用途：手动结束批处理并触发提交。

## 内部能力说明

响应式内部调度与调试函数（如 reactive 树预链接、深度策略切换、内部遍历）属于框架内部能力，文档页不再展开展示。若你在业务侧需要类似能力，建议优先使用本页已列出的公开 API 组合实现。

## 示例

::: code-group

```vue [TypeScript]
<script setup lang="ts">
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
