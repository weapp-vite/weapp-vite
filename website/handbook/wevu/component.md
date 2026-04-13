---
title: 组件通信
description: 在 wevu 里怎么做 props、emit 和 slots，以及和 Web Vue 的区别。
keywords:
  - handbook
  - wevu
  - component
  - props
  - emit
---

# 组件通信

组件通信就三件事：父给子数据、子给父事件、插槽。在小程序里都能做，但要用"宿主视角"来理解。

## props：父组件给子组件数据

用 `<script setup>` 的话：

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

用 `defineComponent` 的话，通过 `properties`：

```ts
export default defineComponent({
  properties: {
    title: { type: String, value: '' },
    price: { type: Number, value: 0 },
  },
  setup(props) {
    // props.title, props.price 是响应式的
  },
})
```

父组件使用：

```vue
<GoodsCard title="键盘" :price="199" />
```

## emit：子组件给父组件事件

```vue
<!-- 子组件 -->
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

```vue
<!-- 父组件 -->
<GoodsCard @select="onGoodsSelect" />
```

用 `defineComponent` 的话，通过 `ctx.emit`：

```ts
export default defineComponent({
  setup(props, ctx) {
    function onTap() {
      ctx.emit('select', { id: 'sku-1' })
    }
    return { onTap }
  },
})
```

底层走的是小程序的 `triggerEvent`。

## slots：插槽

默认插槽可以正常用：

```vue
<BaseCard>
  <view>这里是插槽内容</view>
</BaseCard>
```

但不要默认以为 Web Vue 里复杂的作用域插槽都能照搬。小程序的组件隔离机制和浏览器不一样，复杂插槽模式要实际验证。

## 组件设计的建议

组件对外只暴露两类东西：

- 输入：props
- 输出：事件

不要让外部依赖组件的内部实现细节。props 定义清晰、事件语义明确，组件就好维护。

## 接下来

- [状态管理](/handbook/wevu/store)
- [表单和双向绑定](/handbook/wevu/bind-model)
