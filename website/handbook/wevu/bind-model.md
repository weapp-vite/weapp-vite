---
title: bindModel：表单多了以后怎么收口
description: 当表单组件越来越多、事件和值来源越来越不统一时，如何用 bindModel 把取值、设值和转换逻辑集中管理。
keywords:
  - handbook
  - wevu
  - bindModel
  - 表单
---

# bindModel：表单多了以后怎么收口

简单表单里，`v-model` 往往已经够用了。
但一旦页面开始出现这些情况：

- 输入框用 `input`
- 选择器用 `change`
- 上传组件值在 `detail.files`
- 滑块要做 number 转换

你就会发现每个字段都在写不同的事件处理函数。

这时 `bindModel` 的价值就出来了。

## 它适合解决什么问题

一句话：

> 把“某个字段怎么从事件里取值，再写回状态”这件事统一收口。

## 一个典型场景

```ts
import { useBindModel } from 'wevu'

const bindModel = useBindModel()

const onNameChange = bindModel<string>('form.name').model({ event: 'change' }).onChange
const onBudgetChange = bindModel<number>('form.budget').model({ event: 'change' }).onChange
```

模板里就会更统一：

```vue
<t-input :value="form.name" @change="onNameChange" />

<t-slider :value="form.budget" @change="onBudgetChange" />
```

## 它最适合什么页面

通常是：

- 后台配置页
- 多字段业务表单
- 使用大量第三方组件库的页面

因为这些页面里最麻烦的不是“有没有绑定”，而是“绑定规则太多种了”。

## 一个更复杂一点的例子

例如上传组件值不在 `detail.value`，而在 `detail.files`：

```ts
const onAttachmentsChange = bindModel<UploadFile[]>('form.attachments').model({
  event: 'change',
  valueProp: 'files',
  parser: event => event?.detail?.files ?? [],
}).onChange
```

这时你就不需要在页面里手写一堆特判逻辑。

## 什么时候不用它更好

如果页面只有两三个简单字段：

```vue
<input v-model="form.name" />

<input v-model="form.phone" />
```

那继续用简单 `v-model` 往往更直观。

## 一句话建议

`bindModel` 不是替代所有 `v-model`，而是在“事件和值来源开始复杂”之后帮你把表单逻辑统一起来。
