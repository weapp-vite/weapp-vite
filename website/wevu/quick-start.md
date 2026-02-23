---
title: 快速上手
---

# 快速上手 wevu

这页给你一条“最短可跑通”的路线：装包 → 写一个页面/组件 → （可选）接入 Store。示例以 weapp-vite + Vue SFC 为主；如果你不使用 SFC，也可以只参考运行时 API 的用法。

## 1. 安装

::: code-group

```sh [pnpm]
pnpm add -D wevu
```

```sh [yarn]
yarn add -D wevu
```

```sh [npm]
npm i -D wevu
```

```sh [bun]
bun add -D wevu
```

:::

:::tip
运行时 API 均从 `wevu` 主入口导入；`wevu/compiler` 仅供 weapp-vite 等编译侧工具使用（非稳定用户 API）。
:::

## 2. （可选）启用 Volar 插件

如果你正在使用 weapp-vite + Vue SFC 开发小程序，可以在 `tsconfig.app.json`（或项目主 `tsconfig.json`）里启用 weapp-vite 的 Volar 插件，以获得模板侧的更好类型推导：

```json
{
  "vueCompilerOptions": {
    "plugins": ["weapp-vite/volar"],
    "lib": "wevu"
  }
}
```

:::warning 必须设置 lib
`"vueCompilerOptions.lib": "wevu"` 用于告诉 Volar 从 wevu 的类型声明里解析 `defineProps/withDefaults/defineEmits` 等脚本宏。若不设置，Volar 会按 Vue 默认宏处理，最终只剩 `any` 类型提示。
:::

:::note wevu@1.2.0 起的 vue 依赖说明
从 wevu@1.2.0 开始，`wevu` 会依赖 `vue`，但只用于获取其 `dts` 类型定义，不会引入任何 Vue 运行时代码。这样做是为了让 Volar 在 `<script setup>` 下正确解析 `props`、宏类型与 IDE 跳转（此前尝试过多种方案仍无法稳定解决）。业务代码仍应从 `wevu` 导入运行时 API。
:::

## 3. 写一个页面（SFC 示例）

`defineComponent()` 会在运行时通过小程序全局 `Component()` 注册页面/组件；`setup()` 返回的状态会参与快照 diff，并最小化 `setData`。

```vue
<!-- pages/counter/index.vue -->
<script setup lang="ts">
import { computed, onPageScroll, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '计数器',
}))

const count = ref(0)
const doubled = computed(() => count.value * 2)
const reachedTop = ref(true)

onPageScroll(({ scrollTop }) => {
  reachedTop.value = scrollTop < 40
})

function inc() {
  count.value += 1
}
</script>

<template>
  <view class="page">
    <text>count: {{ count }} / doubled: {{ doubled }}</text>
    <text v-if="!reachedTop">
      正在滚动...
    </text>
    <button @tap="inc">
      +1
    </button>
  </view>
</template>
```

## 4. 引入自定义组件（小程序规则）

推荐使用 Script Setup JSON 宏声明 `usingComponents`；脚本里无需（也不推荐）`import` 子组件：

```vue
<script setup lang="ts">
definePageJson(() => ({
  usingComponents: {
    'my-card': '/components/MyCard/index',
  },
}))
</script>
```

模板中直接 `<my-card />` 使用即可。

## 5. 组件 props / emit（运行时约定）

`setup` 与 Vue 3 对齐，仅支持 `setup(props, ctx)`。
若不需要 `props`，可写 `setup(_, ctx)`；若不需要 `ctx`，可只写 `setup(props)`。

`ctx.props` 来自小程序 `properties`；`ctx.emit(event, ...args)` 会调用小程序 `triggerEvent` 触发自定义事件。

```vue
<!-- components/Stepper/index.vue -->
<script lang="ts">
import { computed, defineComponent } from 'wevu'

export default defineComponent({
  properties: { modelValue: { type: Number, value: 0 } },
  setup(props, ctx) {
    const value = computed({
      get: () => props.modelValue ?? 0,
      set: v => ctx.emit('update:modelValue', v),
    })
    const inc = () => (value.value += 1)
    const dec = () => (value.value -= 1)
    return { value, inc, dec }
  },
})
</script>
```

```vue
<!-- 使用 -->
<template>
  <Stepper v-model="amount" />
</template>
```

## 6. 接入 Store（可选但常用）

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

```ts
// pages/counter/index.ts
import { defineComponent, storeToRefs } from 'wevu'
import { useCounter } from '@/stores/counter'

export default defineComponent({
  setup() {
    const counter = useCounter()
    const { count, doubled } = storeToRefs(counter)
    return { count, doubled, inc: counter.inc }
  },
})
```

下一步建议阅读：

- [`defineComponent` / 生命周期 / `bindModel`](/wevu/runtime)
- [Store API](/wevu/store)
