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

### API 支持覆盖率报告

| 平台 | 可调用 API 数 | 语义对齐 API 数 | fallback API 数 | API 总数 | 可调用覆盖率 | 语义对齐覆盖率 |
| --- | --- | --- | --- | --- | --- | --- |
| 微信小程序 (`wx`) | 479 | 479 | 0 | 479 | 100.00% | 100.00% |
| 支付宝小程序 (`my`) | 479 | 216 | 263 | 479 | 100.00% | 45.09% |
| 抖音小程序 (`tt`) | 478 | 153 | 325 | 479 | 99.79% | 31.94% |
| 三端可调用完全对齐 (wx/my/tt) | 478 | - | - | 479 | 99.79% | - |
| 三端语义完全对齐 (wx/my/tt) | - | 145 | - | 479 | - | 30.27% |

> 该报告由 `WEAPI_METHOD_SUPPORT_MATRIX` 与映射规则自动计算生成。

### 核心跨端映射矩阵

| API | 说明 | 微信策略 | 支付宝策略 | 抖音策略 | 支持度 |
| --- | --- | --- | --- | --- | --- |
| `showToast` | 显示消息提示框。 | 直连 `wx.showToast` | `title/icon` 映射到 `content/type` 后调用 `my.showToast` | `icon=error` 映射为 `fail` 后调用 `tt.showToast` | ✅ |
| `showLoading` | 显示 loading 提示框。 | 直连 `wx.showLoading` | `title` 映射到 `content` 后调用 `my.showLoading` | 直连 `tt.showLoading` | ✅ |
| `showActionSheet` | 显示操作菜单。 | 直连 `wx.showActionSheet` | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | 直连 `tt.showActionSheet`，并兼容 `index` → `tapIndex` | ✅ |
| `showModal` | 显示模态弹窗。 | 直连 `wx.showModal` | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果 | 直连 `tt.showModal` | ✅ |
| `chooseImage` | 选择图片。 | 直连 `wx.chooseImage` | 返回值 `apFilePaths` 映射到 `tempFilePaths` | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底 | ✅ |
| `saveFile` | 保存文件（跨端扩展，微信 typings 未声明同名 API）。 | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath` | ⚠️ |
| `setClipboardData` | 设置剪贴板内容。 | 直连 `wx.setClipboardData` | 转调 `my.setClipboard` 并映射 `data` → `text` | 直连 `tt.setClipboardData` | ✅ |
| `getClipboardData` | 获取剪贴板内容。 | 直连 `wx.getClipboardData` | 转调 `my.getClipboard` 并映射 `text` → `data` | 直连 `tt.getClipboardData` | ✅ |
| `chooseAddress` | 选择收货地址。 | 直连 `wx.chooseAddress` | 映射到 `my.getAddress` | 直连 `tt.chooseAddress` | ⚠️ |
| `createAudioContext` | 创建音频上下文。 | 直连 `wx.createAudioContext` | 映射到 `my.createInnerAudioContext` | 映射到 `tt.createInnerAudioContext` | ⚠️ |
| `createWebAudioContext` | 创建 WebAudio 上下文。 | 直连 `wx.createWebAudioContext` | 映射到 `my.createInnerAudioContext` | 映射到 `tt.createInnerAudioContext` | ⚠️ |
| `getSystemInfoAsync` | 异步获取系统信息。 | 直连 `wx.getSystemInfoAsync` | 映射到 `my.getSystemInfo` | 映射到 `tt.getSystemInfo` | ✅ |
| `openAppAuthorizeSetting` | 打开小程序授权设置页。 | 直连 `wx.openAppAuthorizeSetting` | 映射到 `my.openSetting` | 映射到 `tt.openSetting` | ⚠️ |
| `pluginLogin` | 插件登录。 | 直连 `wx.pluginLogin` | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段 | 映射到 `tt.login` | ⚠️ |
| `login` | 登录。 | 直连 `wx.login` | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段 | 直连 `tt.login` | ⚠️ |
| `authorize` | 提前向用户发起授权请求。 | 直连 `wx.authorize` | 映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数 | 直连 `tt.authorize` | ⚠️ |
| `checkSession` | 检查登录态是否过期。 | 直连 `wx.checkSession` | 映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok` | 直连 `tt.checkSession` | ⚠️ |
| `requestSubscribeDeviceMessage` | 请求订阅设备消息。 | 直连 `wx.requestSubscribeDeviceMessage` | 映射到 `my.requestSubscribeMessage` | 映射到 `tt.requestSubscribeMessage` | ⚠️ |
| `requestSubscribeEmployeeMessage` | 请求订阅员工消息。 | 直连 `wx.requestSubscribeEmployeeMessage` | 映射到 `my.requestSubscribeMessage` | 映射到 `tt.requestSubscribeMessage` | ⚠️ |
| `restartMiniProgram` | 重启小程序。 | 直连 `wx.restartMiniProgram` | 映射到 `my.reLaunch` | 映射到 `tt.reLaunch` | ⚠️ |
| `scanCode` | 扫码。 | 直连 `wx.scanCode` | 映射到 `my.scan` | 直连 `tt.scanCode` | ✅ |
| `requestPayment` | 发起支付。 | 直连 `wx.requestPayment` | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
| `requestOrderPayment` | 发起订单支付。 | 直连 `wx.requestOrderPayment` | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
| `requestPluginPayment` | 发起插件支付。 | 直连 `wx.requestPluginPayment` | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
| `requestVirtualPayment` | 发起虚拟支付。 | 直连 `wx.requestVirtualPayment` | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
| `showShareImageMenu` | 显示分享图片菜单。 | 直连 `wx.showShareImageMenu` | 映射到 `my.showSharePanel` | 映射到 `tt.showShareMenu` | ⚠️ |
| `updateShareMenu` | 更新分享菜单配置。 | 直连 `wx.updateShareMenu` | 映射到 `my.showSharePanel` | 映射到 `tt.showShareMenu` | ⚠️ |
| `openEmbeddedMiniProgram` | 打开嵌入式小程序。 | 直连 `wx.openEmbeddedMiniProgram` | 映射到 `my.navigateToMiniProgram` | 映射到 `tt.navigateToMiniProgram` | ⚠️ |
| `saveFileToDisk` | 保存文件到磁盘。 | 直连 `wx.saveFileToDisk` | 直连 `my.saveFileToDisk` | 映射到 `tt.saveFile` | ⚠️ |
| `getEnterOptionsSync` | 获取启动参数（同步）。 | 直连 `wx.getEnterOptionsSync` | 直连 `my.getEnterOptionsSync` | 映射到 `tt.getLaunchOptionsSync` | ⚠️ |
| `getSystemSetting` | 获取系统设置。 | 直连 `wx.getSystemSetting` | 直连 `my.getSystemSetting` | 映射到 `tt.getSetting` | ⚠️ |
| `getUserProfile` | 获取用户资料。 | 直连 `wx.getUserProfile` | 映射到 `my.getOpenUserInfo` | 直连 `tt.getUserProfile` | ⚠️ |
| `getUserInfo` | 获取用户信息。 | 直连 `wx.getUserInfo` | 映射到 `my.getOpenUserInfo` | 直连 `tt.getUserInfo` | ⚠️ |
| `getAppAuthorizeSetting` | 获取 App 授权设置。 | 直连 `wx.getAppAuthorizeSetting` | 直连 `my.getAppAuthorizeSetting` | 映射到 `tt.getSetting` | ⚠️ |
| `getAppBaseInfo` | 获取 App 基础信息。 | 直连 `wx.getAppBaseInfo` | 直连 `my.getAppBaseInfo` | 映射到 `tt.getEnvInfoSync` | ⚠️ |
| `chooseVideo` | 选择视频。 | 直连 `wx.chooseVideo` | 直连 `my.chooseVideo` | 映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构 | ⚠️ |
| `hideHomeButton` | 隐藏返回首页按钮。 | 直连 `wx.hideHomeButton` | 映射到 `my.hideBackHome` | 直连 `tt.hideHomeButton` | ✅ |
| `getWindowInfo` | 获取窗口信息。 | 直连 `wx.getWindowInfo` | 直连 `my.getWindowInfo` | 映射到 `tt.getSystemInfo`，并提取窗口字段 | ⚠️ |
| `getDeviceInfo` | 获取设备基础信息。 | 直连 `wx.getDeviceInfo` | 映射到 `my.getSystemInfo`，并提取设备字段 | 映射到 `tt.getSystemInfo`，并提取设备字段 | ⚠️ |
| `getAccountInfoSync` | 同步获取当前账号信息。 | 直连 `wx.getAccountInfoSync` | 直连 `my.getAccountInfoSync` | 映射到 `tt.getEnvInfoSync`，并对齐账号字段结构 | ⚠️ |
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
- 可通过 `wpi.resolveTarget('showModal')` 查看当前平台目标方法与可用性
- 可通过 `wpi.supports('showModal')` 快速判断当前平台是否支持调用
- 缺失 API 时：
  - 回调风格触发 `fail/complete`
  - Promise 风格返回 rejected Promise

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
