# @wevu/api

## 简介

`@wevu/api` 提供跨平台的小程序 API 封装，默认推荐 Promise 风格，同时兼容传统回调风格。

## 特性

- 动态代理，覆盖微信小程序全量 API
- 跨平台适配（微信/支付宝/百度/字节/QQ/快应用/京东/小红书/快手/淘宝等）
- Promise 风格优先，回调风格可用
- 支持显式注入平台适配器

## 类型对齐与平台支持

`@wevu/api` 的默认导出 `wpi` 会同时对齐：

- 微信类型：`miniprogram-api-typings`
- 支付宝类型：`@mini-types/alipay`

| 平台                          | 全局对象       | 类型来源                  | 对齐状态          |
| ----------------------------- | -------------- | ------------------------- | ----------------- |
| 微信小程序                    | `wx`           | `miniprogram-api-typings` | ✅ 全量           |
| 支付宝小程序                  | `my`           | `@mini-types/alipay`      | ✅ 全量           |
| 其他平台（tt/swan/jd/xhs 等） | 运行时宿主对象 | 运行时透传                | ⚠️ 按宿主能力支持 |

以下方法在 weapi 中提供了跨端参数/返回值对齐，并在类型注释里附带平台支持度表格：

- `showToast`
- `showLoading`
- `showActionSheet`
- `showModal`
- `chooseImage`
- `saveFile`
- `setClipboardData`
- `getClipboardData`

## 安装

```bash
pnpm add @wevu/api
```

## 使用

### Promise 风格（推荐）

```ts
import { wpi } from '@wevu/api'

const res = await wpi.request({
  url: 'https://example.com',
  method: 'GET',
})

console.log(res)
```

### 回调风格（兼容）

```ts
import { wpi } from '@wevu/api'

wpi.request({
  url: 'https://example.com',
  method: 'GET',
  success(res) {
    console.log(res)
  },
  fail(err) {
    console.error(err)
  },
})
```

### 显式注入平台适配器

```ts
import { createWeapi } from '@wevu/api'

const api = createWeapi({
  adapter: wx,
  platform: 'wx',
})

await api.getSystemInfo()
```

## 行为说明

- **只在不传回调时返回 Promise**
- 同步 API（`*Sync`）与事件 API（`onXxx/offXxx`）直接透传
- 缺失 API 时：
  - 回调风格触发 `fail/complete`
  - Promise 风格返回 rejected Promise

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
