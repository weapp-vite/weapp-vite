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
| 支付宝小程序 (`my`) | 195 | 195 | 0 | 479 | 40.71% | 40.71% |
| 抖音小程序 (`tt`) | 131 | 131 | 0 | 479 | 27.35% | 27.35% |
| 三端可调用完全对齐 (wx/my/tt) | 115 | - | - | 479 | 24.01% | - |
| 三端语义完全对齐 (wx/my/tt) | - | 115 | - | 479 | - | 24.01% |

> 该报告由 `WEAPI_METHOD_SUPPORT_MATRIX` 与映射规则自动计算生成。

### 核心跨端映射矩阵

| API | 说明 | 微信策略 | 支付宝策略 | 抖音策略 | 支持度 |
| --- | --- | --- | --- | --- | --- |
| `showToast` | 显示消息提示框。 | 直连 `wx.showToast` | `title/icon` 映射到 `content/type` 后调用 `my.showToast` | `icon=error` 映射为 `fail` 后调用 `tt.showToast` | ✅ |
| `showLoading` | 显示 loading 提示框。 | 直连 `wx.showLoading` | `title` 映射到 `content` 后调用 `my.showLoading` | 直连 `tt.showLoading` | ✅ |
| `showActionSheet` | 显示操作菜单。 | 直连 `wx.showActionSheet` | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | 直连 `tt.showActionSheet`；缺失时按 unsupported 报错 | ⚠️ |
| `showModal` | 显示模态弹窗。 | 直连 `wx.showModal` | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果 | 直连 `tt.showModal` | ✅ |
| `chooseImage` | 选择图片。 | 直连 `wx.chooseImage` | 返回值 `apFilePaths` 映射到 `tempFilePaths` | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底 | ✅ |
| `chooseMedia` | 选择图片或视频。 | 直连 `wx.chooseMedia` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType` | ⚠️ |
| `chooseMessageFile` | 选择会话文件。 | 直连 `wx.chooseMessageFile` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getFuzzyLocation` | 获取模糊地理位置。 | 直连 `wx.getFuzzyLocation` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `previewMedia` | 预览图片和视频。 | 直连 `wx.previewMedia` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createInterstitialAd` | 创建插屏广告实例。 | 直连 `wx.createInterstitialAd` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.createInterstitialAd` | ⚠️ |
| `createRewardedVideoAd` | 创建激励视频广告实例。 | 直连 `wx.createRewardedVideoAd` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createLivePlayerContext` | 创建直播播放器上下文。 | 直连 `wx.createLivePlayerContext` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.createLivePlayerContext` | ⚠️ |
| `createLivePusherContext` | 创建直播推流上下文。 | 直连 `wx.createLivePusherContext` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getVideoInfo` | 获取视频详细信息。 | 直连 `wx.getVideoInfo` | 直连 `my.getVideoInfo` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `saveFile` | 保存文件（跨端扩展，微信 typings 未声明同名 API）。 | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath` | ⚠️ |
| `setClipboardData` | 设置剪贴板内容。 | 直连 `wx.setClipboardData` | 转调 `my.setClipboard` 并映射 `data` → `text` | 直连 `tt.setClipboardData` | ✅ |
| `getClipboardData` | 获取剪贴板内容。 | 直连 `wx.getClipboardData` | 转调 `my.getClipboard` 并映射 `text` → `data` | 直连 `tt.getClipboardData` | ✅ |
| `chooseAddress` | 选择收货地址。 | 直连 `wx.chooseAddress` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.chooseAddress` | ⚠️ |
| `createAudioContext` | 创建音频上下文。 | 直连 `wx.createAudioContext` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createWebAudioContext` | 创建 WebAudio 上下文。 | 直连 `wx.createWebAudioContext` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getSystemInfoAsync` | 异步获取系统信息。 | 直连 `wx.getSystemInfoAsync` | 映射到 `my.getSystemInfo` | 映射到 `tt.getSystemInfo` | ✅ |
| `openAppAuthorizeSetting` | 打开小程序授权设置页。 | 直连 `wx.openAppAuthorizeSetting` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `pluginLogin` | 插件登录。 | 直连 `wx.pluginLogin` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `login` | 登录。 | 直连 `wx.login` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.login` | ⚠️ |
| `authorize` | 提前向用户发起授权请求。 | 直连 `wx.authorize` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.authorize` | ⚠️ |
| `checkSession` | 检查登录态是否过期。 | 直连 `wx.checkSession` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.checkSession` | ⚠️ |
| `requestSubscribeDeviceMessage` | 请求订阅设备消息。 | 直连 `wx.requestSubscribeDeviceMessage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestSubscribeEmployeeMessage` | 请求订阅员工消息。 | 直连 `wx.requestSubscribeEmployeeMessage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `restartMiniProgram` | 重启小程序。 | 直连 `wx.restartMiniProgram` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `scanCode` | 扫码。 | 直连 `wx.scanCode` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.scanCode` | ⚠️ |
| `requestPayment` | 发起支付。 | 直连 `wx.requestPayment` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestOrderPayment` | 发起订单支付。 | 直连 `wx.requestOrderPayment` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestPluginPayment` | 发起插件支付。 | 直连 `wx.requestPluginPayment` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestVirtualPayment` | 发起虚拟支付。 | 直连 `wx.requestVirtualPayment` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `showShareImageMenu` | 显示分享图片菜单。 | 直连 `wx.showShareImageMenu` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `updateShareMenu` | 更新分享菜单配置。 | 直连 `wx.updateShareMenu` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openEmbeddedMiniProgram` | 打开嵌入式小程序。 | 直连 `wx.openEmbeddedMiniProgram` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `saveFileToDisk` | 保存文件到磁盘。 | 直连 `wx.saveFileToDisk` | 直连 `my.saveFileToDisk` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getEnterOptionsSync` | 获取启动参数（同步）。 | 直连 `wx.getEnterOptionsSync` | 直连 `my.getEnterOptionsSync` | 映射到 `tt.getLaunchOptionsSync` | ⚠️ |
| `getSystemSetting` | 获取系统设置。 | 直连 `wx.getSystemSetting` | 直连 `my.getSystemSetting` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getUserProfile` | 获取用户资料。 | 直连 `wx.getUserProfile` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.getUserProfile` | ⚠️ |
| `getUserInfo` | 获取用户信息。 | 直连 `wx.getUserInfo` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.getUserInfo` | ⚠️ |
| `getAppAuthorizeSetting` | 获取 App 授权设置。 | 直连 `wx.getAppAuthorizeSetting` | 直连 `my.getAppAuthorizeSetting` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getAppBaseInfo` | 获取 App 基础信息。 | 直连 `wx.getAppBaseInfo` | 直连 `my.getAppBaseInfo` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `chooseVideo` | 选择视频。 | 直连 `wx.chooseVideo` | 直连 `my.chooseVideo` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `hideHomeButton` | 隐藏返回首页按钮。 | 直连 `wx.hideHomeButton` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.hideHomeButton` | ⚠️ |
| `getWindowInfo` | 获取窗口信息。 | 直连 `wx.getWindowInfo` | 直连 `my.getWindowInfo` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getDeviceInfo` | 获取设备基础信息。 | 直连 `wx.getDeviceInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getAccountInfoSync` | 同步获取当前账号信息。 | 直连 `wx.getAccountInfoSync` | 直连 `my.getAccountInfoSync` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setBackgroundColor` | 动态设置窗口背景色。 | 直连 `wx.setBackgroundColor` | 直连 `my.setBackgroundColor` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setBackgroundTextStyle` | 动态设置下拉背景字体样式。 | 直连 `wx.setBackgroundTextStyle` | 直连 `my.setBackgroundTextStyle` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getNetworkType` | 获取网络类型。 | 直连 `wx.getNetworkType` | 直连 `my.getNetworkType` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getBatteryInfo` | 异步获取电量信息。 | 直连 `wx.getBatteryInfo` | 直连 `my.getBatteryInfo` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getBatteryInfoSync` | 同步获取电量信息。 | 直连 `wx.getBatteryInfoSync` | 直连 `my.getBatteryInfoSync` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getLogManager` | 获取日志管理器实例。 | 直连 `wx.getLogManager` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `nextTick` | 延迟到下一个 UI 更新时机执行回调。 | 直连 `wx.nextTick` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `onWindowResize` | 监听窗口尺寸变化事件。 | 直连 `wx.onWindowResize` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.onWindowResize` | ⚠️ |
| `offWindowResize` | 取消监听窗口尺寸变化事件。 | 直连 `wx.offWindowResize` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.offWindowResize` | ⚠️ |
| `reportAnalytics` | 上报分析数据。 | 直连 `wx.reportAnalytics` | 无同等 API，调用时按 unsupported 报错 | 直连 `tt.reportAnalytics` | ⚠️ |
| `openCustomerServiceChat` | 打开客服会话。 | 直连 `wx.openCustomerServiceChat` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createVKSession` | 创建视觉识别会话。 | 直连 `wx.createVKSession` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `compressVideo` | 压缩视频文件。 | 直连 `wx.compressVideo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openVideoEditor` | 打开视频编辑器。 | 直连 `wx.openVideoEditor` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getShareInfo` | 获取转发详细信息。 | 直连 `wx.getShareInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `joinVoIPChat` | 加入音视频通话。 | 直连 `wx.joinVoIPChat` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openDocument` | 打开文档。 | 直连 `wx.openDocument` | 直连 `my.openDocument` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `saveVideoToPhotosAlbum` | 保存视频到系统相册。 | 直连 `wx.saveVideoToPhotosAlbum` | 直连 `my.saveVideoToPhotosAlbum` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `batchSetStorage` | 批量异步写入缓存。 | 直连 `wx.batchSetStorage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `batchGetStorage` | 批量异步读取缓存。 | 直连 `wx.batchGetStorage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `batchSetStorageSync` | 批量同步写入缓存。 | 直连 `wx.batchSetStorageSync` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `batchGetStorageSync` | 批量同步读取缓存。 | 直连 `wx.batchGetStorageSync` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createCameraContext` | 创建相机上下文对象。 | 直连 `wx.createCameraContext` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `offMemoryWarning` | 取消内存不足告警监听。 | 直连 `wx.offMemoryWarning` | 直连 `my.offMemoryWarning` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `cancelIdleCallback` | 取消空闲回调。 | 直连 `wx.cancelIdleCallback` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `onBLEConnectionStateChange` | 监听 BLE 连接状态变化。 | 直连 `wx.onBLEConnectionStateChange` | 映射到 `my.onBLEConnectionStateChanged` | 抖音无同等 API，调用时报 not supported | ⚠️ |
| `offBLEConnectionStateChange` | 取消监听 BLE 连接状态变化。 | 直连 `wx.offBLEConnectionStateChange` | 映射到 `my.offBLEConnectionStateChanged` | 抖音无同等 API，调用时报 not supported | ⚠️ |
| `addCard` | 添加微信卡券。 | 直连 `wx.addCard` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addFileToFavorites` | 添加文件到收藏。 | 直连 `wx.addFileToFavorites` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addPaymentPassFinish` | 添加支付 pass 完成回调。 | 直连 `wx.addPaymentPassFinish` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addPaymentPassGetCertificateData` | 添加支付 pass 证书数据回调。 | 直连 `wx.addPaymentPassGetCertificateData` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addPhoneCalendar` | 添加日历事件。 | 直连 `wx.addPhoneCalendar` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addPhoneContact` | 添加手机联系人。 | 直连 `wx.addPhoneContact` | 直连 `my.addPhoneContact` | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addPhoneRepeatCalendar` | 添加重复日历事件。 | 直连 `wx.addPhoneRepeatCalendar` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `addVideoToFavorites` | 添加视频到收藏。 | 直连 `wx.addVideoToFavorites` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `authorizeForMiniProgram` | 获取小程序授权码。 | 直连 `wx.authorizeForMiniProgram` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `authPrivateMessage` | 校验私密消息。 | 直连 `wx.authPrivateMessage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `bindEmployeeRelation` | 绑定员工关系。 | 直连 `wx.bindEmployeeRelation` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `canAddSecureElementPass` | 检测是否可添加安全元素卡片。 | 直连 `wx.canAddSecureElementPass` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `canvasGetImageData` | 获取 canvas 区域像素数据。 | 直连 `wx.canvasGetImageData` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `canvasPutImageData` | 将像素数据绘制到 canvas。 | 直连 `wx.canvasPutImageData` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkDeviceSupportHevc` | 检测设备是否支持 HEVC 解码。 | 直连 `wx.checkDeviceSupportHevc` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkEmployeeRelation` | 查询员工关系绑定状态。 | 直连 `wx.checkEmployeeRelation` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkIsAddedToMyMiniProgram` | 检测是否已添加到我的小程序。 | 直连 `wx.checkIsAddedToMyMiniProgram` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkIsOpenAccessibility` | 检测系统无障碍是否开启。 | 直连 `wx.checkIsOpenAccessibility` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkIsPictureInPictureActive` | 检测是否处于画中画状态。 | 直连 `wx.checkIsPictureInPictureActive` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkIsSoterEnrolledInDevice` | 检测设备是否录入 SOTER 信息。 | 直连 `wx.checkIsSoterEnrolledInDevice` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `checkIsSupportSoterAuthentication` | 检测设备是否支持 SOTER 生物认证。 | 直连 `wx.checkIsSupportSoterAuthentication` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openCard` | 打开卡券详情。 | 直连 `wx.openCard` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openChannelsActivity` | 打开视频号活动页。 | 直连 `wx.openChannelsActivity` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openChannelsEvent` | 打开视频号活动详情。 | 直连 `wx.openChannelsEvent` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openChannelsLive` | 打开视频号直播。 | 直连 `wx.openChannelsLive` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openChannelsLiveNoticeInfo` | 打开视频号直播预告详情。 | 直连 `wx.openChannelsLiveNoticeInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openChannelsUserProfile` | 打开视频号用户主页。 | 直连 `wx.openChannelsUserProfile` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openChatTool` | 打开客服工具页。 | 直连 `wx.openChatTool` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openHKOfflinePayView` | 打开香港线下支付视图。 | 直连 `wx.openHKOfflinePayView` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openInquiriesTopic` | 打开询价话题。 | 直连 `wx.openInquiriesTopic` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openOfficialAccountArticle` | 打开公众号文章。 | 直连 `wx.openOfficialAccountArticle` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openOfficialAccountChat` | 打开公众号会话。 | 直连 `wx.openOfficialAccountChat` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openOfficialAccountProfile` | 打开公众号主页。 | 直连 `wx.openOfficialAccountProfile` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openPrivacyContract` | 打开隐私协议页面。 | 直连 `wx.openPrivacyContract` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openSystemBluetoothSetting` | 打开系统蓝牙设置页面。 | 直连 `wx.openSystemBluetoothSetting` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `reportEvent` | 上报事件埋点。 | 直连 `wx.reportEvent` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `reportMonitor` | 上报监控数据。 | 直连 `wx.reportMonitor` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `reportPerformance` | 上报性能数据。 | 直连 `wx.reportPerformance` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openSingleStickerView` | 打开单个表情贴纸详情。 | 直连 `wx.openSingleStickerView` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openStickerIPView` | 打开表情 IP 页面。 | 直连 `wx.openStickerIPView` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openStickerSetView` | 打开表情包详情页。 | 直连 `wx.openStickerSetView` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openStoreCouponDetail` | 打开小店优惠券详情。 | 直连 `wx.openStoreCouponDetail` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `openStoreOrderDetail` | 打开小店订单详情。 | 直连 `wx.openStoreOrderDetail` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `pauseBackgroundAudio` | 暂停后台音频。 | 直连 `wx.pauseBackgroundAudio` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `pauseVoice` | 暂停播放语音。 | 直连 `wx.pauseVoice` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `playBackgroundAudio` | 播放后台音频。 | 直连 `wx.playBackgroundAudio` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `playVoice` | 播放语音。 | 直连 `wx.playVoice` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `postMessageToReferrerMiniProgram` | 向来源小程序发送消息。 | 直连 `wx.postMessageToReferrerMiniProgram` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `postMessageToReferrerPage` | 向来源页面发送消息。 | 直连 `wx.postMessageToReferrerPage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `preDownloadSubpackage` | 预下载分包。 | 直连 `wx.preDownloadSubpackage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `preloadAssets` | 预加载资源。 | 直连 `wx.preloadAssets` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `preloadSkylineView` | 预加载 Skyline 视图。 | 直连 `wx.preloadSkylineView` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `preloadWebview` | 预加载 WebView 页面。 | 直连 `wx.preloadWebview` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `removeSecureElementPass` | 移除安全元素卡片。 | 直连 `wx.removeSecureElementPass` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `chooseInvoiceTitle` | 选择发票抬头。 | 直连 `wx.chooseInvoiceTitle` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `chooseLicensePlate` | 选择车牌号。 | 直连 `wx.chooseLicensePlate` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `choosePoi` | 选择兴趣点 POI。 | 直连 `wx.choosePoi` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `closeBLEConnection` | 断开低功耗蓝牙连接。 | 直连 `wx.closeBLEConnection` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createBLEConnection` | 创建低功耗蓝牙连接。 | 直连 `wx.createBLEConnection` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `cropImage` | 裁剪图片。 | 直连 `wx.cropImage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `editImage` | 编辑图片。 | 直连 `wx.editImage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `exitVoIPChat` | 退出音视频通话。 | 直连 `wx.exitVoIPChat` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `faceDetect` | 人脸检测。 | 直连 `wx.faceDetect` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getApiCategory` | 获取 API 分类信息。 | 直连 `wx.getApiCategory` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getBackgroundFetchToken` | 获取后台拉取 token。 | 直连 `wx.getBackgroundFetchToken` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getChannelsLiveInfo` | 获取视频号直播信息。 | 直连 `wx.getChannelsLiveInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getChannelsLiveNoticeInfo` | 获取视频号直播预告信息。 | 直连 `wx.getChannelsLiveNoticeInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getChannelsShareKey` | 获取视频号分享 key。 | 直连 `wx.getChannelsShareKey` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getChatToolInfo` | 获取客服工具信息。 | 直连 `wx.getChatToolInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getCommonConfig` | 获取通用配置。 | 直连 `wx.getCommonConfig` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getGroupEnterInfo` | 获取群聊进入信息。 | 直连 `wx.getGroupEnterInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getPrivacySetting` | 获取隐私设置。 | 直连 `wx.getPrivacySetting` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `initFaceDetect` | 初始化人脸检测。 | 直连 `wx.initFaceDetect` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `join1v1Chat` | 发起 1v1 通话。 | 直连 `wx.join1v1Chat` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareAppMessageToGroup` | 分享到群聊会话。 | 直连 `wx.shareAppMessageToGroup` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareEmojiToGroup` | 分享到群聊表情。 | 直连 `wx.shareEmojiToGroup` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareFileMessage` | 分享文件消息。 | 直连 `wx.shareFileMessage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareFileToGroup` | 分享文件到群。 | 直连 `wx.shareFileToGroup` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareImageToGroup` | 分享图片到群。 | 直连 `wx.shareImageToGroup` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareToOfficialAccount` | 分享至公众号。 | 直连 `wx.shareToOfficialAccount` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareToWeRun` | 分享至微信运动。 | 直连 `wx.shareToWeRun` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareVideoMessage` | 分享视频消息。 | 直连 `wx.shareVideoMessage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `shareVideoToGroup` | 分享视频到群。 | 直连 `wx.shareVideoToGroup` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `showRedPackage` | 展示红包组件。 | 直连 `wx.showRedPackage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startDeviceMotionListening` | 开始监听设备方向变化。 | 直连 `wx.startDeviceMotionListening` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startHCE` | 启动 HCE 功能。 | 直连 `wx.startHCE` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startLocalServiceDiscovery` | 开始本地服务发现。 | 直连 `wx.startLocalServiceDiscovery` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startLocationUpdate` | 开始持续定位。 | 直连 `wx.startLocationUpdate` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startLocationUpdateBackground` | 开始后台持续定位。 | 直连 `wx.startLocationUpdateBackground` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startRecord` | 开始录音。 | 直连 `wx.startRecord` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `startSoterAuthentication` | 开始 SOTER 认证。 | 直连 `wx.startSoterAuthentication` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopBackgroundAudio` | 停止后台音频。 | 直连 `wx.stopBackgroundAudio` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopDeviceMotionListening` | 停止监听设备方向变化。 | 直连 `wx.stopDeviceMotionListening` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopFaceDetect` | 停止人脸检测。 | 直连 `wx.stopFaceDetect` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestCommonPayment` | 发起通用支付请求。 | 直连 `wx.requestCommonPayment` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestDeviceVoIP` | 请求设备 VoIP 能力。 | 直连 `wx.requestDeviceVoIP` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestMerchantTransfer` | 发起商家转账请求。 | 直连 `wx.requestMerchantTransfer` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requirePrivacyAuthorize` | 请求隐私授权。 | 直连 `wx.requirePrivacyAuthorize` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `reserveChannelsLive` | 预约视频号直播。 | 直连 `wx.reserveChannelsLive` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `selectGroupMembers` | 选择群成员。 | 直连 `wx.selectGroupMembers` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `sendHCEMessage` | 发送 HCE 消息。 | 直连 `wx.sendHCEMessage` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `sendSms` | 发送短信。 | 直连 `wx.sendSms` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setBackgroundFetchToken` | 设置后台拉取 token。 | 直连 `wx.setBackgroundFetchToken` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setEnable1v1Chat` | 设置 1v1 通话可用状态。 | 直连 `wx.setEnable1v1Chat` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setTopBarText` | 设置顶栏文本。 | 直连 `wx.setTopBarText` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setWindowSize` | 设置窗口尺寸。 | 直连 `wx.setWindowSize` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopHCE` | 停止 HCE 功能。 | 直连 `wx.stopHCE` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopLocalServiceDiscovery` | 停止本地服务发现。 | 直连 `wx.stopLocalServiceDiscovery` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopLocationUpdate` | 停止持续定位。 | 直连 `wx.stopLocationUpdate` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopRecord` | 停止录音。 | 直连 `wx.stopRecord` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `stopVoice` | 停止播放语音。 | 直连 `wx.stopVoice` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `subscribeVoIPVideoMembers` | 订阅 VoIP 视频成员变化。 | 直连 `wx.subscribeVoIPVideoMembers` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `updateVoIPChatMuteConfig` | 更新 VoIP 静音配置。 | 直连 `wx.updateVoIPChatMuteConfig` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `updateWeChatApp` | 拉起微信升级流程。 | 直连 `wx.updateWeChatApp` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getBackgroundAudioPlayerState` | 获取后台音频播放状态。 | 直连 `wx.getBackgroundAudioPlayerState` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getDeviceBenchmarkInfo` | 获取设备性能评估信息。 | 直连 `wx.getDeviceBenchmarkInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getDeviceVoIPList` | 获取设备 VoIP 列表。 | 直连 `wx.getDeviceVoIPList` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getHCEState` | 获取 HCE 状态。 | 直连 `wx.getHCEState` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getInferenceEnvInfo` | 获取推理环境信息。 | 直连 `wx.getInferenceEnvInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getNFCAdapter` | 获取 NFC 适配器。 | 直连 `wx.getNFCAdapter` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getPerformance` | 获取性能对象。 | 直连 `wx.getPerformance` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getRandomValues` | 获取随机值。 | 直连 `wx.getRandomValues` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getRealtimeLogManager` | 获取实时日志管理器。 | 直连 `wx.getRealtimeLogManager` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getRendererUserAgent` | 获取渲染层 UserAgent。 | 直连 `wx.getRendererUserAgent` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getScreenRecordingState` | 获取录屏状态。 | 直连 `wx.getScreenRecordingState` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getSecureElementPasses` | 获取安全元素卡片列表。 | 直连 `wx.getSecureElementPasses` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getSelectedTextRange` | 获取已选中文本范围。 | 直连 `wx.getSelectedTextRange` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getShowSplashAdStatus` | 获取开屏广告展示状态。 | 直连 `wx.getShowSplashAdStatus` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getSkylineInfo` | 获取 Skyline 信息。 | 直连 `wx.getSkylineInfo` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getUserCryptoManager` | 获取用户加密管理器。 | 直连 `wx.getUserCryptoManager` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getWeRunData` | 获取微信运动数据。 | 直连 `wx.getWeRunData` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `getXrFrameSystem` | 获取 XR 框架系统对象。 | 直连 `wx.getXrFrameSystem` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `isBluetoothDevicePaired` | 判断蓝牙设备是否已配对。 | 直连 `wx.isBluetoothDevicePaired` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `isVKSupport` | 判断是否支持视觉识别能力。 | 直连 `wx.isVKSupport` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createBLEPeripheralServer` | 创建 BLE 外设服务实例。 | 直连 `wx.createBLEPeripheralServer` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createBufferURL` | 创建缓冲区 URL。 | 直连 `wx.createBufferURL` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createCacheManager` | 创建缓存管理器。 | 直连 `wx.createCacheManager` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createGlobalPayment` | 创建全局支付对象。 | 直连 `wx.createGlobalPayment` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createInferenceSession` | 创建推理会话。 | 直连 `wx.createInferenceSession` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createMediaAudioPlayer` | 创建媒体音频播放器。 | 直连 `wx.createMediaAudioPlayer` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createMediaContainer` | 创建媒体容器实例。 | 直连 `wx.createMediaContainer` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createMediaRecorder` | 创建媒体录制器。 | 直连 `wx.createMediaRecorder` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createTCPSocket` | 创建 TCP Socket。 | 直连 `wx.createTCPSocket` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createUDPSocket` | 创建 UDP Socket。 | 直连 `wx.createUDPSocket` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `createVideoDecoder` | 创建视频解码器。 | 直连 `wx.createVideoDecoder` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `loadBuiltInFontFace` | 加载内置字体。 | 直连 `wx.loadBuiltInFontFace` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `notifyGroupMembers` | 通知群成员。 | 直连 `wx.notifyGroupMembers` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `requestIdleCallback` | 空闲时回调请求。 | 直连 `wx.requestIdleCallback` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `revokeBufferURL` | 释放缓冲区 URL。 | 直连 `wx.revokeBufferURL` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `rewriteRoute` | 重写路由规则。 | 直连 `wx.rewriteRoute` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `seekBackgroundAudio` | 调整后台音频播放进度。 | 直连 `wx.seekBackgroundAudio` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setEnableDebug` | 设置调试开关。 | 直连 `wx.setEnableDebug` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
| `setInnerAudioOption` | 设置内部音频选项。 | 直连 `wx.setInnerAudioOption` | 无同等 API，调用时按 unsupported 报错 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
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
