# @wevu/api

`@wevu/api` 提供跨平台小程序 API 封装，默认推荐 Promise 调用方式，同时兼容传统回调风格。

## 何时使用

- 你希望在业务层统一调用 `wx/my/tt` 等平台能力
- 你希望优先使用 Promise，减少回调嵌套
- 你希望按平台显式注入适配器

## 安装

```bash
pnpm add @wevu/api
```

## Promise 风格（推荐）

```ts
import { wpi } from '@wevu/api'

const res = await wpi.request({
  url: 'https://example.com',
  method: 'GET',
})
```

## 回调风格（兼容）

```ts
import { wpi } from '@wevu/api'

wpi.request({
  url: 'https://example.com',
  success(res) {
    console.log(res)
  },
})
```

## 显式注入平台

```ts
import { createWeapi } from '@wevu/api'

const api = createWeapi({
  adapter: wx,
  platform: 'wx',
})
```

## 行为说明

- 仅在未传回调时返回 Promise
- `*Sync` 与 `onXxx/offXxx` 直连宿主 API
- 缺失 API 时，Promise 风格会 `reject`，回调风格会触发 `fail`
