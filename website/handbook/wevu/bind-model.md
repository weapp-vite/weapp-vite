---
title: bindModel：双向绑定方案
description: bindModel 的完整说明在：/wevu/runtime#bindModel：模型绑定
keywords:
  - Wevu
  - Vue SFC
  - handbook
  - bind
  - model
  - bindModel：双向绑定方案
  - bindmodel
---

# bindModel：双向绑定方案

## 本章你会学到什么

- 为什么小程序的 v-model 容易踩坑（事件与 value 字段不统一）
- 如何用 `bindModel(path, options?)` 把“取值/设值/格式化”收敛成一个工具

## 适用场景

- 表单字段多、事件差异多（input/textarea/picker）
- 需要统一做 number/trim/空值处理

## 使用示例（script setup）

```ts
import type { UploadFile } from 'tdesign-miniprogram/upload/type'
import { useBindModel } from 'wevu'

const bindModel = useBindModel()

const onNameChange = bindModel<string>('form.name').model({ event: 'change' }).onChange
const onBudgetChange = bindModel<number>('form.budget').model({ event: 'change' }).onChange
const onAttachmentsChange = bindModel<UploadFile[]>('form.attachments').model({
  event: 'change',
  valueProp: 'files',
  parser: event => event?.detail?.files ?? [],
}).onChange
```

```vue
<t-input :value="form.name" @change="onNameChange" />

<t-slider :value="form.budget" @change="onBudgetChange" />

<t-upload :files="form.attachments" @change="onAttachmentsChange" />
```

> 注意：Weapp-vite 模板编译目前不支持 `v-bind="object"` 的对象展开语法（不会生成任何属性），建议使用显式 `:value` + `@change/@input` 绑定。

## 参考入口

`bindModel` 的完整说明在：`/wevu/runtime#bindModel：模型绑定`

建议配合本教程表单章节一起看：`/handbook/sfc/forms`
