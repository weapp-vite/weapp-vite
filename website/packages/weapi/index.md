---
title: "@wevu/api"
description: "@wevu/api 提供跨平台小程序 API 封装，默认推荐 Promise 调用方式，同时兼容传统回调风格。"
keywords:
  - Wevu
  - api
  - packages
  - weapi
  - "@wevu/api"
  - 提供跨平台小程序
  - 封装
  - 默认推荐
---

# `@wevu/api`

`@wevu/api` 提供跨平台小程序 API 封装，默认推荐 Promise 调用方式，同时兼容传统回调风格。

如果你在找“一个类似 `uni` / `Taro` 的统一 API 对象”，那它就是这层能力本体；`wevu/api` 只是它在 Wevu 命名空间下的透传入口。

## 何时使用

- 你希望在业务层统一调用 `wx / my / tt` 等平台能力
- 你希望优先使用 Promise，减少回调嵌套
- 你希望在运行时探测某个微信命名 API 是否可用
- 你希望按平台显式注入适配器做测试或多宿主适配

## 安装

```bash
pnpm add @wevu/api
```

如果你已经使用 `wevu`，也可以从 [`wevu/api`](/wevu/api-package) 导入同一套能力。

## 基本用法

### Promise 风格（推荐）

```ts
import { wpi } from '@wevu/api'

const res = await wpi.request({
  url: 'https://example.com',
  method: 'GET',
})
```

### 回调风格（兼容）

```ts
import { wpi } from '@wevu/api'

wpi.request({
  url: 'https://example.com',
  success(res) {
    console.log(res)
  },
})
```

### 显式注入平台

```ts
import { createWeapi } from '@wevu/api'

const api = createWeapi({
  adapter: wx,
  platform: 'wx',
})
```

## 这组文档怎么读

- [兼容总览](/packages/weapi/compat-overview)
- [微信基准 API 全量清单](/packages/weapi/wx-method-list)
- [支付宝兼容矩阵](/packages/weapi/alipay-compat-matrix)
- [抖音兼容矩阵](/packages/weapi/douyin-compat-matrix)
- [兼容差异说明](/packages/weapi/gap-notes)
- [平台独有 API 清单](/packages/weapi/platform-only-methods)

## 行为说明

- 仅在未传回调时返回 Promise
- `*Sync` 与 `onXxx/offXxx` 直连宿主 API
- 可通过 `resolveTarget()` / `supports()` 做能力探测
- 缺失 API 时，Promise 风格会 `reject`，回调风格会触发 `fail`

## 与 Wevu 的关系

- `@wevu/api`：独立包本体
- [`wevu/api`](/wevu/api-package)：Wevu 文档体系下的透传入口

如果你关心“在 Wevu 项目里怎么理解和使用这层统一 API 对象”，优先看 [`wevu/api`](/wevu/api-package)。
