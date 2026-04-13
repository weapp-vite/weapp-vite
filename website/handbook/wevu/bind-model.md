---
title: 表单和双向绑定
description: v-model 的边界、什么时候该用显式写法、bindModel 解决什么问题。
keywords:
  - handbook
  - wevu
  - bindModel
  - 表单
  - v-model
---

# 表单和双向绑定

表单是最容易"看起来能写、实际最容易踩坑"的场景。因为你会同时撞上输入事件差异、`v-model` 边界和校验逻辑。

## 简单场景：直接用 v-model

两三个输入框的简单表单，`v-model` 就够了：

```vue
<input v-model="form.name" placeholder="姓名">

<input v-model="form.phone" placeholder="手机号">
```

## v-model 的限制

`v-model` 后面必须是可赋值的左值：

```vue
<!-- ✅ -->
<input v-model="form.name" />

<input v-model="list[index].title" />

<!-- ❌ -->
<input v-model="a + b" />

<input v-model="user?.name" />
```

而且 `v-model` 默认绑定的是 `input` 事件和 `detail.value`。如果组件的事件名或取值方式不一样，`v-model` 就不好使了。

## 什么时候改用显式写法

遇到这些情况，就别硬用 `v-model`：

- 事件名不是 `input`（比如 `change`）
- 值不在 `detail.value`（比如 `detail.files`）
- 需要做类型转换（比如字符串转数字）
- 组件是第三方的，事件协议不确定

显式写法：

```vue
<slider :value="budget" @change="onBudgetChange" />
```

```ts
function onBudgetChange(event: any) {
  budget.value = Number(event.detail.value)
}
```

## 自定义组件支持 v-model

如果你想让自己的组件支持 `v-model`，组件需要做两件事：接收值、通过事件抛出新值。

```vue
<!-- MyInput.vue -->
<script setup lang="ts">
const props = defineProps<{ value: string }>()
const emit = defineEmits<{ input: [value: string] }>()

function onInput(event: any) {
  emit('input', event.detail.value)
}
</script>

<template>
  <input :value="props.value" @input="onInput">
</template>
```

父组件就可以：

```vue
<MyInput v-model="name" />
```

## 表单校验怎么组织

推荐把表单值、错误状态、校验逻辑分开放：

```ts
const form = ref({ name: '', phone: '' })
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.name.trim()) {
    e.name = '请输入姓名'
  }
  if (!/^1\d{10}$/.test(form.value.phone)) {
    e.phone = '请输入正确手机号'
  }
  errors.value = e
  return Object.keys(e).length === 0
}
```

模板只负责展示错误：

```vue
<input v-model="form.name" placeholder="姓名">

<text v-if="errors.name" class="error">
{{ errors.name }}
</text>
```

输入中校验（长度、格式提示）和提交前校验（完整检查）建议分开做。

## bindModel：表单字段多了以后怎么收口

如果页面有很多表单字段，而且不同组件的事件名和取值方式都不一样，每个字段都写一个事件处理函数会很烦。

wevu 提供了 `useBindModel` 来统一处理：

```ts
import { useBindModel } from 'wevu'

const bindModel = useBindModel()

const onNameChange = bindModel<string>('form.name').model({ event: 'change' }).onChange
const onBudgetChange = bindModel<number>('form.budget').model({ event: 'change' }).onChange
```

模板里就统一了：

```vue
<t-input :value="form.name" @change="onNameChange" />

<t-slider :value="form.budget" @change="onBudgetChange" />
```

更复杂的场景，比如上传组件的值在 `detail.files`：

```ts
const onAttachmentsChange = bindModel<UploadFile[]>('form.attachments').model({
  event: 'change',
  valueProp: 'files',
  parser: event => event?.detail?.files ?? [],
}).onChange
```

`bindModel` 支持自定义事件名、值字段、parser 和 formatter。适合后台配置页、多字段业务表单、大量使用第三方组件库的页面。

如果表单只有两三个简单字段，直接 `v-model` 更直观，不需要上 `bindModel`。

## 接下来

写页面和理解运行时的基本功到这里差不多了。接下来开始做业务：

- [页面跳转](/handbook/navigation)
- [网络请求](/handbook/network)
