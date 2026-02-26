---
title: 表单：受控输入与校验
description: 表单：受控输入与校验，聚焦 handbook / sfc 相关场景，覆盖 Weapp-vite 与 Wevu 的能力、配置和实践要点。
keywords:
  - handbook
  - sfc
  - forms
  - 表单：受控输入与校验
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# 表单：受控输入与校验

## 本章你会学到什么

- 小程序输入组件的事件差异
- 如何写出“不卡光标、可校验、可提交”的表单

## 输入类组件的基本模式

- `input/textarea`：通常用 `bind:input` 驱动
- `picker`：通常用 `change`，值来自 `e.detail.value`

## v-model 使用建议

- 只对“简单左值”使用 v-model（`form.name`、`form.items[i].price`）
- 复杂场景用显式事件处理（或用 `bindModel` 封装，见 `/handbook/wevu/bind-model`）

## 校验建议

- “输入中提示”与“提交前校验”分开做
- 异步校验要防并发：最后一次输入的结果才生效
