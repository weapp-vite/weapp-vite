---
title: .vue 怎么变成小程序
description: 解释 .vue 文件在 weapp-vite 里是怎么被编译成小程序四件套的，以及写 Vue SFC 时哪些地方和 Web Vue 一样，哪些地方不一样。
keywords:
  - handbook
  - sfc
  - Vue SFC
  - Weapp-vite
---

# .vue 怎么变成小程序

如果你写过 Web Vue，第一次写小程序 SFC 的时候很容易产生一个错觉："这不就是在写普通 Vue 吗？"

写法确实很像，但跑的地方完全不一样。

## 一个 .vue 文件最终会变成什么

你写的是这样：

```vue
<script setup lang="ts">
import { ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '商品页',
}))

const count = ref(0)
</script>

<template>
  <view class="page">
    <text>{{ count }}</text>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
}
</style>
```

构建之后，它会变成：

```txt
dist/pages/product/
├─ index.js      ← script 部分
├─ index.json    ← definePageJson 的输出
├─ index.wxml    ← template 部分
└─ index.wxss    ← style 部分
```

所以你写 SFC 的时候，脑子里要同时想两件事：

- 我在用 Vue 的方式组织代码
- 但最终产物要遵守小程序的规则

## 四个块各自负责什么

### `<template>`

写视图结构。但要用小程序的标签，不是 HTML 标签：

```vue
<template>
  <view class="card">
    <text>{{ title }}</text>
    <button @tap="submit">
      提交
    </button>
  </view>
</template>
```

用 `view` 不用 `div`，用 `text` 不用 `span`，用 `@tap` 不用 `@click`。

### `<script setup>`

写页面逻辑。推荐默认就用 `<script setup lang="ts">`：

```vue
<script setup lang="ts">
import { computed, ref } from 'wevu'

const price = ref(100)
const discount = ref(0.8)
const finalPrice = computed(() => price.value * discount.value)
</script>
```

### `definePageJson()`

声明页面配置。这是小程序特有的，Web Vue 里没有：

```ts
definePageJson(() => ({
  navigationBarTitleText: '订单列表',
  enablePullDownRefresh: true,
}))
```

它会被编译成页面的 `.json` 文件。

### `<style>`

写样式。最终会变成 `.wxss`，所以有些浏览器里能用的 CSS 在这里不一定行：

```vue
<style scoped>
.page {
  padding: 24rpx; /* rpx 是小程序的响应式单位 */
}
</style>
```

## 和 Web Vue 最容易搞混的三件事

### 1. 响应式 API 要从 wevu 导入

这是新手最常踩的坑。在小程序里，`ref`、`computed`、`watch` 这些要从 `wevu` 导入：

```ts
// ❌ 错的 — 从 vue 导入的在小程序运行时里不会触发页面更新
import { computed, ref } from 'vue'

// ✅ 对的
import { computed, ref } from 'wevu'
```

### 2. 模板最终是 WXML，不是浏览器 DOM

你看到的是 Vue 风格的模板语法，但它会被编译成 WXML。这意味着：

- 事件不是标准 DOM Event，是小程序事件
- 模板表达式的能力有边界
- 不是所有 Vue 的高级模板特性都能用

### 3. 页面配置是小程序概念

`definePageJson()` 设置的是小程序页面的标题、下拉刷新、组件声明这些东西，这在浏览器里是不存在的。

## 一个典型的页面长什么样

```vue
<script setup lang="ts">
import { ref } from 'wevu'
import ProductCard from '../../components/product-card/index.vue'

definePageJson(() => ({
  navigationBarTitleText: '商品列表',
}))

const products = ref([
  { id: '1', title: '键盘', price: 199 },
  { id: '2', title: '鼠标', price: 99 },
])
</script>

<template>
  <view class="page">
    <ProductCard
      v-for="item in products"
      :key="item.id"
      :title="item.title"
      :price="item.price"
    />
  </view>
</template>

<style scoped>
.page {
  padding: 32rpx;
}
</style>
```

这里面你能看到：

- 组件可以直接 `import .vue` 来用
- `v-for`、`:key`、`:title` 这些 Vue 语法都能用
- 但标签是 `view` 不是 `div`

## 怎么判断一个写法在小程序里行不行

问自己一个问题：

> 这个东西最终会落到模板、JSON、事件还是样式产物上？

如果会，就要考虑小程序的限制。比如你想用 `<teleport>`，这在小程序里是没有的，因为 WXML 没有这个概念。

## 接下来

- [模板和事件怎么写](/handbook/sfc/template)
- [脚本逻辑怎么组织](/handbook/sfc/script-setup)
- [组件怎么拆](/handbook/sfc/components)
