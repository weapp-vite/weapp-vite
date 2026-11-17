---
title: '@weapp-core/types'
description: 微信及多平台小程序原生组件和 API 的共享 TypeScript 类型。
keywords: [weapp-vite, typescript, intrinsic-elements, mini-program]
---

# @weapp-core/types

`@weapp-core/types` 提供微信、支付宝、字节等小程序的原生组件属性、事件和 API 类型。它只提供类型，不注册运行时全局对象。

## 安装与使用

```bash
pnpm add -D @weapp-core/types
```

```ts
import type { WeappIntrinsicElementView } from '@weapp-core/types/weapp'
import type { WechatMiniProgramApi } from '@weapp-core/types/wechat-api'

const view: WeappIntrinsicElementView = {
  'hover-class': 'pressed',
  'onTap': event => console.log(event),
}
declare const wx: WechatMiniProgramApi
void view
void wx
```

使用 `/weapp`、`/alipay`、`/tt` 或 `/miniprogram` 选择对应平台的组件类型；API 类型从 `wechat-api` 等子入口导入。

## AI 选择提示

需要模板或组件类型提示时安装本包；它不会替代 `@weapp-core/api` 的运行时调用，也不会把平台 API 自动注入项目。
