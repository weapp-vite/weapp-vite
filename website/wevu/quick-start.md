---
title: 快速上手
---

# 快速上手 wevu

1. 安装依赖（任选其一）

```bash
pnpm add wevu
# npm i wevu
# yarn add wevu
# bun add wevu
```

> 所有 API 均从 `wevu` 主入口导入，无需（也不支持）`wevu/store` 等子路径。

2. 确保 Volar 插件就绪
   在 `tsconfig.app.json`（或项目主 `tsconfig.json`）里启用 weapp-vite 的 Volar 插件：

```json
{
  "vueCompilerOptions": {
    "plugins": ["weapp-vite/volar"]
  }
}
```

3. 写一个页面

```vue
<!-- pages/counter/index.vue -->
<script lang="ts">
import { computed, definePage, onPageScroll, ref } from 'wevu'

export default definePage(
  {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2)
      const reachedTop = ref(true)

      onPageScroll(({ scrollTop }) => {
        reachedTop.value = scrollTop < 40
      })

      return { count, doubled, reachedTop, inc: () => count.value++ }
    },
  },
  { listenPageScroll: true },
)
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

<config lang="jsonc">
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "计数器"
}
</config>
```

4. 引入自定义组件
   weapp-vite 会把 SFC 编译成原生小程序语法，组件需要在 `<config>` 里声明：

```vue
<config lang="jsonc">
{
  "usingComponents": {
    "my-card": "/components/MyCard/index"
  }
}
</config>
```

脚本里无需 `import` 组件，模板中直接 `<my-card />` 使用即可。

5. 组件 + v-model 绑定
   `bindModel` 会自动生成事件和取值字段，适配小程序组件的 `modelValue`/`update:modelValue` 约定：

```vue
<!-- components/Stepper/index.vue -->
<script lang="ts">
import { computed, defineComponent } from 'wevu'

export default defineComponent({
  properties: { modelValue: { type: Number, value: 0 } },
  setup(ctx) {
    const value = computed({
      get: () => ctx.props.modelValue ?? 0,
      set: v => ctx.emit?.('update:modelValue', v),
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

6. 接入 Store（可选但常用）

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
import { definePage, storeToRefs } from 'wevu'
import { useCounter } from '@/stores/counter'

export default definePage({
  setup() {
    const counter = useCounter()
    const { count, doubled } = storeToRefs(counter)
    return { count, doubled, inc: counter.inc }
  },
})
```
