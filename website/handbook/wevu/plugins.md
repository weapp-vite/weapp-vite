---
title: 插件与全局能力
description: 更完整说明：/wevu/runtime#createApp：应用运行时与插件
keywords:
  - Wevu
  - handbook
  - plugins
  - 插件与全局能力
---

# 插件与全局能力

## 本章你会学到什么

- 用 `createApp().use()` 组织全局能力（日志、请求、错误上报等）
- 如何使用 `app.config.globalProperties`

## 基本示例

```ts
import { createApp } from 'wevu'

const app = createApp({ data: () => ({}) })
app.use((runtime) => {
  runtime.config.globalProperties.$log = (...args: any[]) => console.log(...args)
})
```

更完整说明：`/wevu/runtime#createApp：应用运行时与插件`
