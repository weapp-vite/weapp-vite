---
title: wpi 概览
description: wpi 是 @wevu/api 提供的统一跨端 API 对象，支持 Promise、回调、能力探测与显式平台注入。
keywords:
  - wpi
  - "@wevu/api"
  - weapi
  - 跨端 api
  - overview
---

# `wpi` 概览

`wpi` 是 `@wevu/api` 提供的统一跨端 API 对象。

如果你熟悉 `uni` 或 `Taro` 的全局 API 心智，可以把它理解成同一类能力层：

- 业务层不直接依赖单个平台的 `wx / my / tt`
- 统一通过一个对象调用小程序能力
- 由这层对象负责平台探测、方法映射、Promise 化和错误语义

## 何时使用

- 你希望在业务层统一调用 `wx / my / tt` 等平台能力
- 你希望优先使用 Promise，减少回调嵌套
- 你希望在运行时探测某个微信命名 API 是否可用
- 你希望按平台显式注入 adapter 做测试或多宿主适配

## 安装

```bash
pnpm add -D wevu
```

如果你已经使用 `wevu`，也可以从 [`wevu/api`](/wevu/api-package) 导入同一套能力。

## 基本用法

### Promise 风格

```ts
import { wpi } from 'wevu/api'

const res = await wpi.request({
  url: 'https://example.com',
  method: 'GET',
})
```

### 回调风格

```ts
import { wpi } from 'wevu/api'

wpi.request({
  url: 'https://example.com',
  success(res) {
    console.log(res)
  },
})
```

### 显式实例

```ts
import { createWeapi } from 'wevu/api'

const api = createWeapi({
  adapter: wx,
  platform: 'wx',
})
```

## 行为说明

- 仅在未传回调时返回 Promise
- `*Sync` 与 `onXxx/offXxx` 直连宿主 API
- 可通过 `resolveTarget()` / `supports()` 做能力探测
- 缺失 API 时，Promise 风格会 `reject`，回调风格会触发 `fail`

## 下一步

- 想看整体覆盖情况：[/packages-runtime/weapi/compat-overview](/packages-runtime/weapi/compat-overview)
- 想查具体 API：[/packages-runtime/weapi/wx-method-list](/packages-runtime/weapi/wx-method-list)
- 想理解 Wevu 体系里的入口区别：[/wevu/api-package](/wevu/api-package)
