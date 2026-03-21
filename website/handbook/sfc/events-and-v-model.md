---
title: 事件与 v-model：怎么绑定最稳
description: 从 input、picker、自定义组件这些最常见场景出发，解释小程序里的事件语义和 v-model 边界，帮助新用户少踩双向绑定的坑。
keywords:
  - handbook
  - sfc
  - events
  - v-model
  - 事件
---

# 事件与 v-model：怎么绑定最稳

在 Web Vue 里，很多人对事件和 `v-model` 已经形成了很强的直觉。
但在小程序里，这套直觉要稍微修正一下。

## 第一条建议：事件名优先按小程序语义写

日常最推荐的还是这些：

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

这样写的好处是：团队不会误以为这里就是浏览器 DOM 事件。

## 一个最常见的输入场景

```vue
<script setup lang="ts">
import { ref } from 'wevu'

const form = ref({
  name: '',
})
</script>

<template>
  <input v-model="form.name" placeholder="请输入姓名">
</template>
```

这种简单左值场景，`v-model` 通常是最省心的。

## 但要记住：这里的 `v-model` 本质不是 Web DOM v-model

它最终仍然会落成小程序事件绑定和赋值表达式，所以有天然边界。

最重要的一条限制是：

> `v-model` 后面的表达式必须是可赋值左值。

推荐：

```vue
<input v-model="form.name" />

<input v-model="form.price" />

<input v-model="list[index].title" />
```

不推荐：

```vue
<input v-model="a + b" />

<input v-model="getName()" />

<input v-model="user?.name" />
```

## 什么时候不用 `v-model` 更稳

如果场景里已经出现下面这些情况，就建议显式写值和事件：

- 事件名不是 `input`
- 取值字段不是 `detail.value`
- 需要做 parser / formatter
- 组件是第三方或原生自定义组件

例如：

```vue
<script setup lang="ts">
import { ref } from 'wevu'

const budget = ref(1000)

function onBudgetChange(event: any) {
  budget.value = Number(event.detail.value)
}
</script>

<template>
  <slider :value="budget" @change="onBudgetChange" />
</template>
```

## 自定义组件支持 `v-model` 的最小协议

如果你希望这样写：

```vue
<MyInput v-model="name" />
```

那组件至少要做到两件事：

1. 接收值
2. 通过约定事件把新值抛出来

一个简化示例：

```vue
<script setup lang="ts">
const props = defineProps<{
  value: string
}>()

const emit = defineEmits<{
  input: [value: string]
}>()

function onInput(event: any) {
  emit('input', event.detail.value)
}
</script>

<template>
  <input :value="props.value" @input="onInput">
</template>
```

## 一个很实用的判断方式

如果你发现自己需要这样思考：

- 这个事件到底叫 `input` 还是 `change`
- 值到底在 `detail.value`、`detail.files` 还是别的字段
- 我要不要先做类型转换

那通常就说明：这时显式写事件处理函数，比强行上 `v-model` 更稳。

## 更复杂的统一方案

如果表单字段很多、组件事件很杂，可以继续看：

- [bindModel：双向绑定方案](/handbook/wevu/bind-model)
- [表单：输入、校验与受控写法](/handbook/sfc/forms)
