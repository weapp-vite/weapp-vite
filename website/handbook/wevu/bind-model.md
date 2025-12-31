---
title: bindModel：双向绑定方案
---

# bindModel：双向绑定方案

## 本章你会学到什么

- 为什么小程序的 v-model 容易踩坑（事件与 value 字段不统一）
- 如何用 `bindModel(path, options?)` 把“取值/设值/格式化”收敛成一个工具

## 适用场景

- 表单字段多、事件差异多（input/textarea/picker）
- 需要统一做 number/trim/空值处理

## 参考入口

`bindModel` 的完整说明在：`/wevu/runtime#bindModel：模型绑定`

建议配合本教程表单章节一起看：`/handbook/sfc/forms`
