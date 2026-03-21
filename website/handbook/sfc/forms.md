---
title: 表单：输入、校验与受控写法
description: 从 input、textarea、picker、自定义表单组件的真实业务场景出发，解释在小程序里怎样写出稳定、不卡光标、可校验的表单。
keywords:
  - handbook
  - sfc
  - forms
  - 表单
  - v-model
---

# 表单：输入、校验与受控写法

表单是新用户最容易“看起来能写、实际最容易踩坑”的场景。

因为这里会同时撞上：

- 输入事件差异
- `v-model` 边界
- 同步与异步校验
- 提交状态管理

## 先看一个常见表单例子

```vue
<script setup lang="ts">
import { ref } from 'wevu'

const form = ref({
  name: '',
  phone: '',
})

const errors = ref({
  name: '',
  phone: '',
})

function validate() {
  errors.value.name = form.value.name ? '' : '请输入姓名'
  errors.value.phone = /^1\d{10}$/.test(form.value.phone) ? '' : '请输入正确手机号'

  return !errors.value.name && !errors.value.phone
}

function submit() {
  if (!validate()) {
    return
  }
  console.log('submit', form.value)
}
</script>

<template>
  <view class="form">
    <input v-model="form.name" placeholder="姓名">
    <text v-if="errors.name">
      {{ errors.name }}
    </text>

    <input v-model="form.phone" placeholder="手机号">
    <text v-if="errors.phone">
      {{ errors.phone }}
    </text>

    <button @tap="submit">
      提交
    </button>
  </view>
</template>
```

这个例子体现了一个很适合新项目的基本思路：

- 表单值单独放
- 错误状态单独放
- 校验函数和提交函数分开

## 输入类组件的常见处理方式

### `input` / `textarea`

简单场景可以直接 `v-model`。

### `picker`

通常更适合显式写 `:value + @change`，因为它的值语义和输入框不完全一致。

例如：

```vue
<picker :value="selectedIndex" :range="cityOptions" @change="onCityChange">
  <view>{{ cityOptions[selectedIndex] }}</view>
</picker>
```

## “输入中校验”和“提交前校验”建议分开

这点特别重要。

### 输入中校验

适合做：

- 长度限制提示
- 必填提示
- 简单格式提示

### 提交前校验

适合做：

- 完整字段检查
- 组合规则校验
- 提交前最后拦截

## 异步校验要注意什么

例如手机号、用户名是否可用这类接口校验，不要每次输入都无控制地直接发请求。

更稳的思路是：

- 做防抖
- 只保留最后一次输入的结果
- 不要让旧请求覆盖新结果

## 什么时候该考虑 `bindModel`

如果你表单里已经出现这种情况：

- 不同组件事件名不一致
- 值不都在 `detail.value`
- 需要统一 number / trim / parser

那就值得继续看：

- [bindModel：双向绑定方案](/handbook/wevu/bind-model)

## 一个很实用的表单建议

不要让模板承担太多表单逻辑。
模板负责展示和触发，脚本负责：

- 值管理
- 错误状态
- 提交流程
- 校验规则

## 一句话总结

表单场景里，能用简单 `v-model` 的地方就用；一旦事件和取值开始复杂，就改成显式受控写法。

接下来建议继续看：

- [bindModel：双向绑定方案](/handbook/wevu/bind-model)
- [运行时：setup、hooks 与更新](/handbook/wevu/runtime)
