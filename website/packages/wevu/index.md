---
title: wevu 运行时指南
---

# wevu 运行时

`wevu` 是面向微信小程序的轻量 Vue 风格运行时，提供响应式、生命周期、计算属性和类 Pinia 的 `defineStore` 能力。它与 weapp-vite 的 Vue SFC 编译链路打通，直接在页面/组件里书写 Vue 习惯的代码和模板。

> ✅ 从 0.0.1 起，`store` API 统一从主入口导出，无需再写 `wevu` 子路径。

## 安装与使用方式

- **依赖安装**：`pnpm add wevu`（使用 weapp-vite 模板时已默认带上）。
- **基础入口**：在页面/组件脚本中直接 `import { definePage, defineComponent, ref, computed, watch, defineStore } from 'wevu'`。
- **注册特性**：页面特性（滚动监听、分享等）通过 `definePage(options, features)` 第二个参数开启。

## 快速开始：一个计数页面

```vue
<!-- pages/counter/index.vue -->
<script lang="ts">
import { computed, definePage, onShow, ref } from 'wevu'

export default definePage({
  setup() {
    const count = ref(1)
    const doubled = computed(() => count.value * 2)

    const add = () => count.value++
    onShow(() => console.log('page show'))

    return { count, doubled, add }
  },
})
</script>

<template>
  <view class="page">
    <text>count: {{ count }}</text>
    <text>doubled: {{ doubled }}</text>
    <button @tap="add">
      +1
    </button>
  </view>
</template>
```

## 生命周期与 watch

- 在 `setup()` 里使用 `onShow/onHide/onReady/onPageScroll/onShareAppMessage/onAddToFavorites` 等小程序生命周期钩子。
- 使用 `watch` / `watchEffect` 追踪响应式数据变化：

```ts
import { definePage, onReady, ref, watch } from 'wevu'

export default definePage({
  setup() {
    const keyword = ref('')
    const logs: string[] = []

    onReady(() => logs.push('page ready'))

    watch(keyword, (val) => {
      logs.push(`keyword changed: ${val}`)
    })

    return { keyword, logs }
  },
})
```

## 组件与属性

自定义组件沿用小程序 `properties` 配置，并在 `setup` 中访问：

```ts
// components/UserCard/index.ts
import { defineComponent, ref } from 'wevu'

export default defineComponent({
  properties: {
    username: String,
  },
  setup(ctx) {
    const liked = ref(false)
    const toggle = () => {
      liked.value = !liked.value
      ctx.emit?.('like', liked.value)
    }
    return { liked, toggle }
  },
})
```

## 状态管理：defineStore（主入口导出）

`defineStore`、`storeToRefs`、`createStore` 直接从 `wevu` 导出，支持选项式和 setup 式两种写法：

```ts
// stores/counter.ts
import { createStore, defineStore } from 'wevu'

createStore() // 注册一次即可，支持插件 use()

export const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    doubled(state) {
      return state.count * 2
    },
  },
  actions: {
    inc() {
      this.count += 1
    },
  },
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

    counter.$subscribe((mutation) => {
      console.log('[counter]', mutation.type)
    })

    return { count, doubled, inc: counter.inc }
  },
})
```

## 进阶特性与建议

- **Computed 可写**：使用 `computed({ get, set })` 构建双向绑定属性。
- **批量 setData 优化**：响应式更新会自动批量 diff 并调用一次 `setData`。
- **分享/收藏能力**：`definePage` 第二个参数传入 `{ enableShareAppMessage: true, enableShareTimeline: true, enableAddToFavorites: true }`。
- **保持 Vue 习惯**：`ref/reactive/watchEffect/nextTick` 等与 Vue 3 保持一致，迁移成本低。

## 更多案例

查看 [案例合集](/packages/wevu/examples) 获取更完整的页面、组件、Store 与生命周期组合示例。更多 API 可参考源码 `packages/wevu/src` 与仓库内的 `wevu-*` 示例应用。
