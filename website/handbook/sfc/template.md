---
title: Template：语法与差异点
---

# Template：语法与差异点

## 本章你会学到什么

- 模板语法哪些“像 Vue”，哪些“更像 WXML”
- 事件、列表、条件渲染的推荐写法

## 推荐心智模型

- 你写的是 Vue 风格模板，但最终会落到 WXML。
- 一些 Web/Vue 的习惯（DOM、原生事件、复杂表达式）在小程序里并不成立。

## 常用写法

- 条件：`v-if / v-else-if / v-else`
- 列表：`v-for="item in list" :key="item.id"`
- class/style：`:class="..."`、`:style="{ ... }"`
- 事件：`@tap="onTap"`、`@input="onInput"`

## 事件命名建议

- 优先用小程序事件（如 `tap`、`input`、`change`），避免用 Web 事件名误导团队。

## 常见坑

- 在模板里做重计算（建议放到 `computed`）
- 在模板里调用会产生副作用的函数（尽量只做纯展示）

## 相关链接

- Vue SFC 总入口：`/guide/vue-sfc`
- 原生 WXML 语法直通：`/handbook/sfc/native-wxml`
