---
title: 事件与 v-model：绑定策略
---

# 事件与 v-model：绑定策略

## 本章你会学到什么

- 小程序事件与 Vue 事件心智差异
- v-model 在小程序里为什么“看起来像 Vue，但本质不是”

## 事件：优先使用小程序事件名

- 推荐：`@tap`、`@input`、`@change`、`@blur`
- 不推荐：`@click`（容易让团队以为是 DOM click）

## v-model：本质是“赋值表达式事件”

weapp-vite 的 SFC 模板编译会把 `v-model="x"` 直接编译成小程序的赋值表达式事件（例如 `bind:input="x = $event.detail.value"`），因此存在天然限制：

- 表达式必须可赋值（左值）：`x` / `x.y` / `x[i]`
- 不要写：`a + b`、函数调用、可选链（`a?.b`）

更完整的映射表与扩展方式请参考：`/wevu/vue-sfc#v-model-支持范围与限制`

## 自定义组件的 v-model 协议（简版）

如果你希望 `<MyInput v-model="value" />` 可用，需要组件：

- 接收 `value`（或约定字段）作为 props
- 触发 `input` 事件，且 `detail.value` 带回新值

更强的双向绑定方案：`/handbook/wevu/bind-model`
