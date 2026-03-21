---
title: Template：先学哪些写法
description: 从新用户最常写的页面结构、列表、条件、事件出发，解释小程序 SFC 模板该怎么写最稳，以及哪些 Web Vue 习惯要主动收住。
keywords:
  - handbook
  - sfc
  - template
  - 模板
  - Vue SFC
---

# Template：先学哪些写法

如果你已经会写 Vue，第一次写小程序 SFC 模板时最重要的不是“会不会写”，而是“哪些写法最稳”。

因为这里的模板虽然长得像 Vue，但最终会落到 WXML。

## 先建立一个够用的判断标准

模板里优先做这三类事：

- 展示数据
- 绑定事件
- 组织列表和条件分支

尽量不要在模板里做这两类事：

- 复杂计算
- 有副作用的函数调用

## 一个推荐的页面模板形态

先看一个日常页面例子：

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
    <input
      :value="keyword"
      placeholder="搜索商品"
      @input="onSearchInput"
    >

    <view v-if="hasData">
      <view
        v-for="item in goodsList"
        :key="item.id"
        class="goods-item"
      >
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

这段代码里，已经包含了小程序 SFC 最常见的 4 种模板能力：

- `v-if / v-else`
- `v-for`
- `:value` / `:class`
- `@input` / `@tap`

## 条件渲染怎么写最稳

优先使用：

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

这种链路在新项目里最常见，也最容易维护。

建议把条件判断尽量收敛在脚本层，例如：

```ts
const isEmpty = computed(() => !loading.value && list.value.length === 0)
```

然后模板里只负责展示。

## 列表渲染的推荐姿势

标准写法：

```vue
<view
  v-for="item in list"
  :key="item.id"
>
  {{ item.title }}
</view>
```

尽量保证 `:key`：

- 稳定
- 语义明确
- 不依赖易变索引

如果列表项需要复杂展示，推荐尽快拆成子组件：

```vue
<GoodsCard
  v-for="item in list"
  :key="item.id"
  :title="item.title"
  :price="item.price"
/>
```

## 事件优先用小程序语义

推荐优先使用：

- `@tap`
- `@input`
- `@change`
- `@blur`

例如：

```vue
<button @tap="submitOrder">
  提交订单
</button>
```

这会比 `@click` 更不容易误导团队，因为它更贴近宿主语义。

## 不推荐在模板里做什么

### 1. 重计算

不推荐：

```vue
<text>
{{ price * count * discountMap[type] }}
</text>
```

推荐改成：

```ts
function getFinalPrice(item: CartItem) {
  return item.price * item.count * discountMap[item.type]
}
```

### 2. 副作用调用

不推荐：

```vue
<text>
{{ trackExpose(item.id) }}
</text>
```

模板应尽量保持“纯展示”。

## class 和 style 怎么看待

简单动态 class 可以直接写：

```vue
<view :class="{ active: isActive, disabled: loading }" />
```

行内 style 可以用，但建议克制。
新项目更推荐把样式逻辑尽量交给 class。

## 一个新用户很容易踩的坑

你看到的是“Vue 风格模板”，但不要默认以为：

- 所有 Web 事件都能照搬
- 模板表达式可以无限复杂
- 所有插槽和 DOM 心智都完全一致

如果某个模板能力已经明显涉及 WXML 边界，就优先回看：

- [原生 WXML：什么时候保留](/handbook/sfc/native-wxml)

## 一句话建议

先把模板写成“简单、稳定、可预期”的样子，再追求花哨写法。

接下来建议继续看：

- [Script Setup：推荐日常范式](/handbook/sfc/script-setup)
- [事件与 v-model：怎么绑定最稳](/handbook/sfc/events-and-v-model)
