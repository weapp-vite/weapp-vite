---
title: 组件怎么拆
description: 什么时候该拆组件、怎么导入、什么时候还需要 usingComponents、原生组件怎么接类型。
keywords:
  - handbook
  - sfc
  - components
  - 组件
---

# 组件怎么拆

页面能跑起来之后，下一个问题就是：什么时候该拆组件，拆完怎么接回页面。

## 默认方式：直接 import .vue

```vue
<script setup lang="ts">
import OrderCard from './components/order-card.vue'
import OrderEmpty from './components/order-empty.vue'
</script>

<template>
  <OrderCard v-for="item in list" :key="item.id" :data="item" />
  <OrderEmpty v-if="isEmpty" />
</template>
```

这是新项目推荐的默认方式。好处是 IDE 跳转稳、重构安全、依赖关系一目了然。

## 什么时候该拆

出现这些信号就值得拆：

- 页面模板超过 100 行了
- 同一块 UI 在多个页面出现
- 某块区域有自己的状态和行为
- 你开始复制粘贴同样的模板结构

## 放哪里

只服务当前页面的组件，放页面目录下：

```txt
pages/order-list/
├─ index.vue
└─ components/
   ├─ order-card.vue
   └─ order-empty.vue
```

多个页面稳定复用的，放全局 `components/`：

```txt
src/components/
├─ empty-state/index.vue
├─ price-text/index.vue
└─ loading-view/index.vue
```

判断标准很简单：如果这个组件只有一个页面在用，就放页面目录。等第二个页面也要用的时候再提升到全局。

## 什么时候还需要 usingComponents

直接 `import .vue` 能覆盖大部分场景。但这些情况还是需要 `usingComponents`：

- 接第三方原生小程序组件（不是 `.vue` 的）
- 引入原生组件目录
- 历史项目还没迁移到 SFC import

```ts
definePageJson(() => ({
  usingComponents: {
    'native-uploader': '/components/native-uploader/index',
  },
}))
```

## 组件的 props 和事件

用 `defineProps` 和 `defineEmits`：

```vue
<!-- components/goods-card/index.vue -->
<script setup lang="ts">
const props = defineProps<{
  title: string
  price: number
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function onTap() {
  emit('select', 'sku-1')
}
</script>

<template>
  <view class="goods-card" @tap="onTap">
    <text>{{ props.title }}</text>
    <text>¥{{ props.price }}</text>
  </view>
</template>
```

父组件使用：

```vue
<GoodsCard title="键盘" :price="199" @select="onGoodsSelect" />
```

如果用的是 `defineComponent` 风格，props 通过 `properties` 声明：

```ts
export default defineComponent({
  properties: {
    title: { type: String, value: '' },
    price: { type: Number, value: 0 },
  },
  setup(props, ctx) {
    // props.title, props.price
    // ctx.emit('select', data)
  },
})
```

## 原生组件怎么加类型

如果你引入的是原生小程序组件（不是 `.vue`），可以用 wevu 提供的类型工具补齐 props 提示：

```ts
import type { InferNativeProps, NativeComponent, NativePropType } from 'wevu'

type Tone = 'neutral' | 'success' | 'danger'

const nativeProperties = {
  label: { type: String, value: '' },
  tone: {
    type: String as NativePropType<Tone>,
    value: 'neutral',
  },
}

type NativeBadgeProps = InferNativeProps<typeof nativeProperties>
const NativeBadge = {} as NativeComponent<NativeBadgeProps>
export default NativeBadge
```

然后在页面里正常用，有类型提示：

```vue
<NativeBadge label="已完成" tone="success" />
```

## 插槽

插槽可以用，但不要默认以为 Web Vue 里复杂的作用域插槽都能照搬。优先用结构清晰的默认插槽：

```vue
<BaseCard>
  <view>这里是插槽内容</view>
</BaseCard>
```

## 接下来

- [常用写法速查](/handbook/sfc/cookbook)
- [Wevu 是什么，不是什么](/handbook/wevu/)
