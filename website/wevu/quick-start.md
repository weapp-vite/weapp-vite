---
title: 快速上手
---

# 快速上手 wevu

## 1. 安装

```bash
pnpm add wevu
# npm i wevu
# yarn add wevu
# bun add wevu
```

:::tip
运行时 API 均从 `wevu` 主入口导入，无需（也不支持）`wevu/store` 等子路径；`wevu/compiler` 仅供 weapp-vite 等编译侧工具使用（非稳定用户 API）。
:::

## 2. （可选）启用 Volar 插件

如果你正在使用 weapp-vite + Vue SFC 开发小程序，可以在 `tsconfig.app.json`（或项目主 `tsconfig.json`）里启用 weapp-vite 的 Volar 插件，以获得模板侧的更好类型推导：

```json
{
  "vueCompilerOptions": {
    "plugins": ["weapp-vite/volar"]
  }
}
```

## 3. 写一个页面（SFC 示例）

`defineComponent()` 会在运行时通过小程序全局 `Component()` 注册页面/组件；`setup()` 返回的状态会参与快照 diff，并最小化 `setData`。

```vue
<!-- pages/counter/index.vue -->
<script lang="ts">
import { computed, defineComponent, onPageScroll, ref } from 'wevu'

export default defineComponent({
  // 小程序部分页面事件是“按需派发”，需要显式开启
  features: { enableOnPageScroll: true },
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)
    const reachedTop = ref(true)

    onPageScroll(({ scrollTop }) => {
      reachedTop.value = scrollTop < 40
    })

    return { count, doubled, reachedTop, inc: () => count.value++ }
  },
})
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

<json>
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "计数器"
}
</json>
```

## 4. 引入自定义组件（小程序规则）

小程序组件需要在页面/组件的 `<json>` 里声明 `usingComponents`；脚本里无需（也不推荐）`import` 子组件：

```vue
<json>
{
  "usingComponents": {
    "my-card": "/components/MyCard/index"
  }
}
</json>
```

模板中直接 `<my-card />` 使用即可。

## 5. 组件 props / emit（运行时约定）

`setup` 支持两种签名：

- `setup(ctx)`：只接收上下文对象
- `setup(props, ctx)`：同时接收 `props` 与 `ctx`

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

- `defineComponent` / 生命周期 / `bindModel`：`/wevu/runtime`
- Store API：`/wevu/store`
