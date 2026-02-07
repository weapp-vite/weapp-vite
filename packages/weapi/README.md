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
- 抖音类型：`@douyin-microapp/typings`

<!-- prettier-ignore-start -->
<!-- @generated weapi-support-matrix:start -->
### 平台类型对齐矩阵

| 平台 | 全局对象 | 类型来源 | 支持度 |
| --- | --- | --- | --- |
| 微信小程序 | `wx` | `miniprogram-api-typings` | ✅ 全量 |
| 支付宝小程序 | `my` | `@mini-types/alipay` | ✅ 全量 |
| 抖音小程序 | `tt` | `@douyin-microapp/typings` | ✅ 全量 |
| 其他平台（swan/jd/xhs 等） | 运行时宿主对象 | 运行时透传 | ⚠️ 按宿主能力支持 |

### 核心跨端映射矩阵

| API | 说明 | 微信策略 | 支付宝策略 | 抖音策略 | 支持度 |
| --- | --- | --- | --- | --- | --- |
| `showToast` | 显示消息提示框。 | 直连 `wx.showToast` | `title/icon` 映射到 `content/type` 后调用 `my.showToast` | `icon=error` 映射为 `fail` 后调用 `tt.showToast` | ✅ |
| `showLoading` | 显示 loading 提示框。 | 直连 `wx.showLoading` | `title` 映射到 `content` 后调用 `my.showLoading` | 直连 `tt.showLoading` | ✅ |
| `showActionSheet` | 显示操作菜单。 | 直连 `wx.showActionSheet` | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | 直连 `tt.showActionSheet` | ✅ |
| `showModal` | 显示模态弹窗。 | 直连 `wx.showModal` | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果 | 直连 `tt.showModal` | ✅ |
| `chooseImage` | 选择图片。 | 直连 `wx.chooseImage` | 返回值 `apFilePaths` 映射到 `tempFilePaths` | `tempFilePaths` 为字符串时归一化为数组 | ✅ |
| `saveFile` | 保存文件。 | 直连 `wx.saveFile` | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | 直连 `tt.saveFile` | ✅ |
| `setClipboardData` | 设置剪贴板内容。 | 直连 `wx.setClipboardData` | 转调 `my.setClipboard` 并映射 `data` → `text` | 直连 `tt.setClipboardData` | ✅ |
| `getClipboardData` | 获取剪贴板内容。 | 直连 `wx.getClipboardData` | 转调 `my.getClipboard` 并映射 `text` → `data` | 直连 `tt.getClipboardData` | ✅ |
<!-- @generated weapi-support-matrix:end -->
<!-- prettier-ignore-end -->

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
