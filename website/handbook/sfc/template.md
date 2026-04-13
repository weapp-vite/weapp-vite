---
title: 模板和事件怎么写
description: 小程序 SFC 模板的日常写法：条件渲染、列表、事件绑定、v-model，以及哪些 Web Vue 的习惯要收一收。
keywords:
  - handbook
  - sfc
  - template
  - 模板
  - 事件
  - v-model
---

# 模板和事件怎么写

模板长得像 Vue，但最终会编译成 WXML。所以关键不是"会不会写"，而是"哪些写法最稳"。

## 日常最常用的几种写法

先看一个包含了大部分常见场景的页面：

```vue
<script setup lang="ts">
import { computed, ref } from 'wevu'

const keyword = ref('')
const goodsList = ref([
  { id: '1', title: '键盘', price: 199 },
  { id: '2', title: '鼠标', price: 99 },
])

const hasData = computed(() => goodsList.value.length > 0)

function onSearchInput(event: any) {
  keyword.value = event.detail.value
}
</script>

<template>
  <view class="page">
    <input :value="keyword" placeholder="搜索商品" @input="onSearchInput">

    <view v-if="hasData">
      <view v-for="item in goodsList" :key="item.id" class="goods-item">
        <text>{{ item.title }}</text>
        <text>¥{{ item.price }}</text>
      </view>
    </view>

    <view v-else class="empty">
      暂无数据
    </view>
  </view>
</template>
```

这里面用到了：`v-if` / `v-else`、`v-for`、`:value`（属性绑定）、`@input`（事件绑定）。这四种覆盖了日常 80% 的模板需求。

## 条件渲染

```vue
<view v-if="loading">
加载中...
</view>

<view v-else-if="list.length">
列表内容
</view>

<view v-else>
空状态
</view>
```

建议把判断逻辑收到脚本里，模板只负责展示：

```ts
const isEmpty = computed(() => !loading.value && list.value.length === 0)
```

## 列表渲染

```vue
<view v-for="item in list" :key="item.id">
  {{ item.title }}
</view>
```

`:key` 尽量用稳定的唯一标识（比如 `id`），不要用数组索引。

列表项复杂的话，尽早拆成子组件：

```vue
<GoodsCard
  v-for="item in list"
  :key="item.id"
  :title="item.title"
  :price="item.price"
/>
```

## 事件绑定

优先用小程序的事件名：

```vue
<button @tap="submitOrder">
提交订单
</button>

<input @input="onInput" @blur="onBlur">

<picker @change="onPickerChange">
...
</picker>
```

用 `@tap` 而不是 `@click`，因为这更贴近小程序的真实语义，团队不容易搞混。

事件对象里的值通常在 `event.detail` 里：

```ts
function onInput(event: any) {
  const value = event.detail.value
}
```

## v-model

简单输入场景可以直接用 `v-model`：

```vue
<input v-model="form.name" placeholder="请输入姓名">
```

但要记住一个限制：`v-model` 后面必须是可赋值的左值。

```vue
<!-- ✅ 这些可以 -->
<input v-model="form.name" />

<input v-model="form.price" />

<input v-model="list[index].title" />

<!-- ❌ 这些不行 -->
<input v-model="a + b" />

<input v-model="getName()" />
```

如果事件名不是 `input`，或者取值不在 `detail.value`，就别硬用 `v-model`，改成显式写法更稳：

```vue
<slider :value="budget" @change="onBudgetChange" />
```

```ts
function onBudgetChange(event: any) {
  budget.value = Number(event.detail.value)
}
```

## 页面配置

每个页面都可以通过 `definePageJson()` 声明配置：

```ts
definePageJson(() => ({
  navigationBarTitleText: '订单详情',
  enablePullDownRefresh: true,
}))
```

App 入口用 `defineAppJson`，组件用 `defineComponentJson`：

```ts
// app.vue
defineAppJson({
  pages: ['pages/home/index', 'pages/profile/index'],
})

// 组件
defineComponentJson(() => ({
  component: true,
}))
```

新项目统一用这些宏就好。老项目里可能还有 `<json>` 块，那是历史兼容写法。

## 动态 class

```vue
<view :class="{ active: isActive, disabled: loading }" />

<view :class="['item', { selected: isSelected }]" />
```

行内 style 能用但建议克制，样式逻辑尽量交给 class。

## 模板里不要做的事

### 不要放复杂计算

```vue
<!-- 不推荐 -->
<text>
{{ price * count * discountMap[type] }}
</text>

<!-- 推荐：算好了再展示 -->
<text>
{{ finalPrice }}
</text>
```

### 不要调有副作用的函数

```vue
<!-- 不推荐 -->
<text>
{{ trackExpose(item.id) }}
</text>
```

模板应该是纯展示的。

## 原生 WXML 语法

weapp-vite 编译模板的时候，Vue 指令（`v-if`、`v-for`）会自动转成对应的 `wx:if`、`wx:for`。你不需要手写 `wx:*`。

但如果你确实需要用原生 WXML 的能力（比如 `<import>`、`<wxs>`、WXML 模板），也可以直接写：

```html
<import src="/partials/card.wxml" />
<template is="card" data="{{item}}" />
```

`<template>` 标签在 Vue 和 WXML 里都有含义。规则是：

- 有 `name`、`is`、`data` 属性的 → 保留为 WXML 模板
- 有 `v-for`、`v-if` 的 → 编译成 `<block>`
- 什么都没有的 → 直接展开子节点

## 接下来

- [脚本逻辑怎么组织](/handbook/sfc/script-setup)
- [组件怎么拆](/handbook/sfc/components)
