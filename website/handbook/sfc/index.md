---
title: 先建立 SFC 心智模型
description: 用新用户最容易理解的方式解释 .vue 文件在 Weapp-vite 里如何落到小程序产物，以及写 Vue SFC 时哪些地方和 Web Vue 一样，哪些地方不一样。
keywords:
  - handbook
  - sfc
  - Vue SFC
  - Weapp-vite
---

# 先建立 SFC 心智模型

如果你已经会写 Web Vue，第一次写小程序 SFC 时最容易出现一种错觉：

“我现在是不是就在写普通 Vue 页面？”

答案是：**写法接近，但宿主和输出完全不是一回事。**

## 先记住最关键的一句话

你写的是 `.vue`，但最终运行的是小程序四件套。

例如这个文件：

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

构建后会变成近似这样的结构：

```txt
dist/pages/product/
├─ index.js
├─ index.json
├─ index.wxml
└─ index.wxss
```

所以你写 SFC 时，脑子里要同时存在两层视角：

- 代码组织层：我是用 Vue 单文件组件来组织页面
- 宿主约束层：最终还是要遵守小程序模板、事件、样式和组件规则

## 一个 `.vue` 文件里的 4 个块分别负责什么

### `<template>`

负责视图结构，但要优先写小程序语义。

例如：

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

这里依然推荐：

- `<view>`、`<text>`、`<button>`
- `@tap`
- 小程序能稳定编译的条件渲染和循环写法

### `<script setup>`

负责页面逻辑，推荐作为默认写法：

```vue
<script setup lang="ts">
import { computed, ref } from 'wevu'

const price = ref(100)
const discount = ref(0.8)
const finalPrice = computed(() => price.value * discount.value)
</script>
```

### `<json>`

或对应的 JSON 宏，负责页面/组件配置。

例如：

```ts
definePageJson(() => ({
  navigationBarTitleText: '订单列表',
}))
```

### `<style>`

负责样式输出，但最终仍要符合小程序宿主能力边界。

## 和 Web Vue 最容易混淆的地方

### 1. 响应式 API 的来源

日常页面/组件开发里，优先从 `wevu` 导入：

```ts
import { computed, ref } from 'wevu'
```

### 2. 模板不是浏览器 DOM

你看到的是 Vue 风格模板，但最终走向是 WXML，不是浏览器 DOM。

这意味着：

- 事件语义不是标准 DOM Event
- 模板表达式能力有小程序边界
- 某些高级插槽或复杂模板能力要谨慎验证

### 3. 页面配置不是 `defineOptions`

在小程序页面里，你还需要处理：

- 页面标题
- 组件声明
- 页面宿主配置

这些不是浏览器页面概念，而是小程序页面概念。

## 新用户应该先掌握哪些内容

建议按这个顺序学 SFC：

1. 模板基础写法
2. `script setup` 的日常范式
3. 页面 JSON 配置怎么写
4. 组件导入与拆分
5. 事件与 `v-model`
6. 样式和资源路径

比如，一个很典型的页面组件组合可能是这样：

```vue
<script setup lang="ts">
import { ref } from 'wevu'
import ProductCard from '../../components/product-card/index.vue'

const products = ref([
  { id: '1', title: '键盘' },
  { id: '2', title: '鼠标' },
])
</script>

<template>
  <view class="page">
    <ProductCard
      v-for="item in products"
      :key="item.id"
      :title="item.title"
    />
  </view>
</template>
```

## 一个实用判断标准

如果你正在犹豫“这件事该从 Vue 角度想，还是从小程序角度想”，就问自己：

> 这个能力最终会不会落到模板、JSON、事件或样式产物上？

如果答案是“会”，那就一定要考虑小程序宿主边界。

## 接下来按这个顺序继续看

- [Template：先学哪些写法](/handbook/sfc/template)
- [Script Setup：推荐日常范式](/handbook/sfc/script-setup)
- [JSON：页面配置放哪里](/handbook/sfc/json)
- [组件：拆分、导入与注册](/handbook/sfc/components)
