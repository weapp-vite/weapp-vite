---
title: Script Setup：推荐日常范式
description: 用页面、组件和 app 入口的常见写法解释为什么新项目应该优先使用 script setup，以及在 Weapp-vite + Wevu 里有哪些固定习惯值得尽早统一。
keywords:
  - handbook
  - sfc
  - script setup
  - Vue SFC
---

# Script Setup：推荐日常范式

如果你问“新项目默认应该怎么写 SFC 脚本逻辑”，答案很明确：

> 优先用 `<script setup lang="ts">`

原因不是“它更潮流”，而是它更适合：

- 页面逻辑按功能拆分
- 组件导入更自然
- 类型提示更完整
- 和 Wevu 的 hooks / 响应式写法更统一

## 一个新页面的推荐起手式

```vue
<script setup lang="ts">
import { computed, onLoad, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '商品列表',
}))

const keyword = ref('')
const goodsList = ref<{ id: string, title: string }[]>([])
const loading = ref(false)

const hasData = computed(() => goodsList.value.length > 0)

onLoad(() => {
  console.log('page loaded')
})
</script>
```

这个起手式里，有几个值得团队统一的习惯：

- 响应式和 hooks 从 `wevu` 导入
- 页面配置优先使用 JSON 宏
- 状态和派生状态放在脚本顶部
- 页面逻辑按“状态 -> 行为 -> 生命周期”组织

## 组件导入推荐直接 `import .vue`

例如：

```vue
<script setup lang="ts">
import EmptyState from '../../components/empty-state/index.vue'
import GoodsCard from '../../components/goods-card/index.vue'
</script>

<template>
  <view>
    <GoodsCard />
    <EmptyState />
  </view>
</template>
```

这样做的好处是：

- IDE 跳转稳定
- 重构更安全
- 组件关系更直观

## app 入口也建议统一成 `app.vue`

一个很小但实用的示例：

```vue
<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/home/index',
  ],
})

onLaunch(() => {
  console.log('app launched')
})
</script>
```

统一用 `app.vue` 的价值在于：

- 全局逻辑、全局样式、全局配置更容易收口
- 团队不会在 `app.ts` / `app.json` / `app.vue` 之间来回摇摆

## 一种很好用的页面组织顺序

日常写页面时，推荐固定顺序：

1. `import`
2. JSON 宏
3. props / 本地状态
4. computed
5. 方法
6. lifecycle hooks

例如：

```ts
import { computed, onShow, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '购物车',
}))

const list = ref<CartItem[]>([])
const loading = ref(false)

const totalPrice = computed(() =>
  list.value.reduce((sum, item) => sum + item.price * item.count, 0),
)

function clearCart() {
  list.value = []
}

onShow(() => {
  console.log('page show')
})
```

## 最容易犯的 3 个错误

### 1. 从 `vue` 导入响应式 API

日常页面逻辑应优先这样写：

```ts
import { computed, ref } from 'wevu'
```

### 2. 在异步回调里注册 hooks

不推荐：

```ts
await fetchSomething()
onShow(() => {})
```

### 3. 明明是 SFC 项目，还在大量手写 `usingComponents`

新项目里，SFC 组件优先 `import`，`usingComponents` 作为补充手段，而不是默认方式。

## 一句话建议

把 `<script setup lang="ts">` 当成默认页面写法，不要每个页面都重新发明组织方式。

接下来建议继续看：

- [JSON：页面配置放哪里](/handbook/sfc/json)
- [组件：拆分、导入与注册](/handbook/sfc/components)
