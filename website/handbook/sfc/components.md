---
title: 组件：拆分、导入与注册
description: 解释新项目里组件应该如何拆分、何时直接 import .vue、何时还需要 usingComponents，以及原生组件如何获得更稳的类型提示。
keywords:
  - handbook
  - sfc
  - components
  - usingComponents
  - Vue SFC
---

# 组件：拆分、导入与注册

页面能跑起来之后，下一个很快会遇到的问题就是：什么时候该拆组件，以及拆完之后怎么接回页面。

## 先看一个推荐的拆分例子

例如订单列表页：

```txt
pages/order-list/
├─ index.vue
└─ components/
   ├─ order-card.vue
   └─ order-empty.vue
```

页面里直接导入：

```vue
<script setup lang="ts">
import OrderCard from './components/order-card.vue'
import OrderEmpty from './components/order-empty.vue'
</script>
```

这是新项目最推荐的默认方式。

## 为什么默认推荐直接 `import .vue`

因为它同时解决了几个非常现实的问题：

- IDE 跳转更直接
- 重构改名更稳
- 类型提示更自然
- 页面依赖关系一眼能看懂

例如：

```vue
<script setup lang="ts">
import GoodsCard from '../../components/goods-card/index.vue'
</script>

<template>
  <GoodsCard title="键盘" :price="199" />
</template>
```

## 什么时候该拆成组件

通常出现下面这些信号，就值得拆：

- 页面模板已经很长
- 同一块 UI 在多个页面复用
- 某块区域有独立状态和行为
- 你开始在模板里反复复制同样结构

比如：

- 商品卡片
- 空状态
- 地址选择块
- 订单状态条

## 什么时候还需要 `usingComponents`

`usingComponents` 不是不能用，而是它在新项目里更适合作为补充方案。

常见场景：

- 接第三方原生小程序组件
- 引入不是 `.vue` 的原生组件目录
- 历史工程尚未完全迁移到 SFC import

例如：

```ts
definePageJson(() => ({
  usingComponents: {
    'native-uploader': '/components/native-uploader/index',
  },
}))
```

## 页面局部组件还是全局组件

一个很好用的判断标准是：

- 只服务当前页面的，放页面目录下
- 多个页面稳定复用的，放全局 `components/`

例如：

更适合页面局部：

- `order-filter-bar`
- `refund-progress-panel`

更适合全局：

- `empty-state`
- `price-text`
- `loading-view`

## 原生组件怎么获得更稳的类型

如果你引入的不是 `.vue`，而是原生小程序组件目录，也可以通过类型工具补齐 props 提示。

例如：

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

然后在页面里照常使用：

```vue
<script setup lang="ts">
import NativeBadge from '../../native/badge/index'
</script>

<template>
  <NativeBadge label="已完成" tone="success" />
</template>
```

## 一句话建议

SFC 新项目里，组件优先 `import .vue`；`usingComponents` 只在你确实需要原生路径映射时再出手。

接下来建议继续看：

- [事件与 v-model：怎么绑定最稳](/handbook/sfc/events-and-v-model)
- [表单：输入、校验与受控写法](/handbook/sfc/forms)
