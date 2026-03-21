---
title: 组件：props、emit、slots
description: 从组件通信最常见的三件事出发，解释 Wevu 里的 props、emit 和 slots 在小程序宿主下分别应该怎么理解。
keywords:
  - handbook
  - wevu
  - component
  - props
  - emit
  - slots
---

# 组件：props、emit、slots

组件通信在小程序里不是不能做，而是更适合用“宿主视角”理解。

你可以把它拆成 3 件事：

- 父组件怎么给子组件数据
- 子组件怎么把事件抛回去
- 插槽能力到底能用到什么程度

## props：先把它理解成输入数据

无论你写的是更接近 Vue 的 props 语义，还是更接近小程序的 `properties` 语义，本质上都是一件事：

> 父组件向子组件输入数据。

一个很简单的例子：

```vue
<!-- goods-card.vue -->
<script setup lang="ts">
const props = defineProps<{
  title: string
  price: number
}>()
</script>

<template>
  <view class="goods-card">
    <text>{{ props.title }}</text>
    <text>¥{{ props.price }}</text>
  </view>
</template>
```

父组件使用：

```vue
<GoodsCard title="键盘" :price="199" />
```

## emit：把它理解成“向父层抛业务事件”

小程序事件最终还是以事件载荷的方式向上走，所以在设计事件时，尽量让事件名和载荷都更明确。

例如：

```vue
<script setup lang="ts">
const emit = defineEmits<{
  select: [{ id: string }]
}>()

function onTap() {
  emit('select', { id: 'sku-1' })
}
</script>

<template>
  <view @tap="onTap">
    点击选择
  </view>
</template>
```

父组件接收：

```vue
<GoodsCard @select="onGoodsSelect" />
```

## slots：要按小程序边界看待

插槽可以用，但不要默认以为 Web Vue 里复杂的插槽模式都能原样照搬。

更适合优先使用的是：

- 结构清晰的默认插槽
- 边界明确的少量插槽位

例如：

```vue
<BaseCard>
  <view>这里是插槽内容</view>
</BaseCard>
```

如果你已经开始高度依赖复杂作用域插槽，建议先评估：

- 是否真的必要
- 是否能拆成更明确的 props + 插槽组合

## 一个很实用的组件设计习惯

组件对外只暴露两类东西：

- 输入：props
- 输出：事件

不要让组件外部过度依赖它的内部细节。

## 一句话总结

在 Wevu 里做组件通信时，优先追求“输入清晰、事件明确、插槽克制”，而不是追求和 Web Vue 完全同构。

接下来建议继续看：

- [Store：状态怎么放更合理](/handbook/wevu/store)
- [provide / inject：依赖注入](/handbook/wevu/provide-inject)
