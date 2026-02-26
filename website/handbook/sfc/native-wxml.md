---
title: Template：原生 WXML 语法直通
description: weapp-vite 会把 Vue 模板编译成 WXML。未被 Vue 指令接管的原生语法（标签/属性/事件）基本按原样保留。
keywords:
  - Vue SFC
  - 编译
  - handbook
  - sfc
  - native
  - wxml
  - Template：原生
  - 语法直通
---

# Template：原生 WXML 语法直通

## 本章你会学到什么

- weapp-vite 如何处理 Vue 模板里的原生 WXML 语法
- 哪些原生语法可以直接写，哪些需要注意

## 结论

weapp-vite 会把 Vue 模板编译成 WXML。未被 Vue 指令接管的原生语法（标签/属性/事件）基本按原样保留。

## 原生语法直通清单

### 结构与列表

- `wx:if` / `wx:elif` / `wx:else`
- `wx:for` / `wx:for-item` / `wx:for-index`
- `wx:key`

### 事件绑定

- `bindtap`、`bind:tap`
- `catchtap`、`catch:tap`
- `capture-bind:tap`
- `capture-catch:tap`
- 其他原生事件同理（例如 `scrolltolower`、`touchstart`）

### 资源/模板相关标签

- `<block>`：结构容器
- `<template name="...">` / `<template is="...">` / `<template data="...">`
- `<import src="...">`
- `<include src="...">`
- `<wxs src="...">` 或内联 `<wxs>`

### 常见原生属性

- `data-*`、`id`、`class`、`style`
- 组件/基础库属性（例如 `mode`、`lazy-load`、`show-menu-by-longpress` 等）

## 与 Vue 语法共存的注意点

- `v-for` / `v-if` 会自动编译为 `wx:for` / `wx:if`，不需要重复写 `wx:*`。
- `:key` 推荐使用稳定的基础类型（如 `item.id`）。复杂表达式会被降级为 `wx:key="*this"` 并提示警告。
- 原生事件可以直接写 `bindtap`，但更推荐 `@tap`（会映射到 `bindtap`）。
- `<template>` 在 Vue 中也有语义；若你要使用 WXML 的模板语法，请显式写 `name`/`is`/`data`，并避免和 `v-slot` 混用。

## `<template>` 何时编译为 WXML template，何时变成 block

这些规则直接来自 weapp-vite 的模板编译逻辑（`transformTemplateElement`）：

### 保留为 WXML `<template>`

当 `<template>` 满足任一条件时，会保留为 WXML 模板标签：

- 存在 `name="..."`（模板定义）
- 存在 `is="..."`（模板引用）
- 存在 `data="..."`（模板数据）

示例（保留为 WXML 模板）：

```wxml
<template>
  <template name="card"><view>...</view></template>
  <template is="card" data="{{item}}" />
</template>
```

### 降级为 `<block>`

当 `<template>` **没有** `name/is/data`，但携带结构指令时，会降级为 `<block>` 以承载小程序指令：

- `v-for` → `<block wx:for="...">`
- `v-if` / `v-else-if` / `v-else` → `<block wx:if|wx:elif|wx:else>`
- 其他指令（如 `v-show`、`v-bind` 等）也会触发降级：会把 `<template>` 替换成 `<block>` 再生成对应属性

示例（降级为 block）：

```html
<template>
  <template v-for="item in list">...</template>
  <template v-if="ok">...</template>
  <template v-show="visible">...</template>
</template>
```

### 直接展开子节点（没有标签输出）

当 `<template>` 既没有 `name/is/data`，也没有任何指令时，会被当作“纯占位”，直接展开子节点，不会输出 `<template>` 或 `<block>`。

### `v-slot` 的特殊情况

`<template v-slot:...>` 作为组件子节点时，会被视为**插槽声明**并转换为 scoped slot 组件，不走 WXML `<template>`/`<block>` 分支。
若在非组件子节点中使用 `<template v-slot>`, 编译器会给出警告并忽略该用法。

## 示例

```wxml
<template>
  <view wx:if="{{show}}">
    <block wx:for="{{list}}" wx:key="id">
      <text bindtap="onTap">
        {{ item.name }}
      </text>
    </block>
  </view>

  <import src="/partials/card.wxml" />
  <template is="card" data="{{item}}" />
</template>
```
