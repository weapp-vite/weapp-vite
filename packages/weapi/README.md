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
| 支付宝小程序 (`my`) | 479 | 354 | 125 | 479 | 100.00% | 73.90% |
| 抖音小程序 (`tt`) | 479 | 296 | 183 | 479 | 100.00% | 61.80% |
| 三端可调用完全对齐 (wx/my/tt) | 479 | - | - | 479 | 100.00% | - |
| 三端语义完全对齐 (wx/my/tt) | - | 294 | - | 479 | - | 61.38% |

> 该报告由 `WEAPI_METHOD_SUPPORT_MATRIX` 与映射规则自动计算生成。

### 核心跨端映射矩阵

| API | 说明 | 微信策略 | 支付宝策略 | 抖音策略 | 支持度 |
| --- | --- | --- | --- | --- | --- |
| `showToast` | 显示消息提示框。 | 直连 `wx.showToast` | `title/icon` 映射到 `content/type` 后调用 `my.showToast` | `icon=error` 映射为 `fail` 后调用 `tt.showToast` | ✅ |
| `showLoading` | 显示 loading 提示框。 | 直连 `wx.showLoading` | `title` 映射到 `content` 后调用 `my.showLoading` | 直连 `tt.showLoading` | ✅ |
| `showActionSheet` | 显示操作菜单。 | 直连 `wx.showActionSheet` | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | 优先直连 `tt.showActionSheet`；缺失时降级到 `tt.showModal` shim | ✅ |
| `showModal` | 显示模态弹窗。 | 直连 `wx.showModal` | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果 | 直连 `tt.showModal` | ✅ |
| `chooseImage` | 选择图片。 | 直连 `wx.chooseImage` | 返回值 `apFilePaths` 映射到 `tempFilePaths` | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底 | ✅ |
| `chooseMedia` | 选择图片或视频。 | 直连 `wx.chooseMedia` | 映射到 `my.chooseImage`，并补齐 `tempFiles[].tempFilePath/fileType` | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType` | ⚠️ |
| `chooseMessageFile` | 选择会话文件。 | 直连 `wx.chooseMessageFile` | 映射到 `my.chooseImage`，并补齐 `tempFiles[].path/name` | 映射到 `tt.chooseImage`，并补齐 `tempFiles[].path/name` | ⚠️ |
| `getFuzzyLocation` | 获取模糊地理位置。 | 直连 `wx.getFuzzyLocation` | 映射到 `my.getLocation` | 映射到 `tt.getLocation` | ⚠️ |
| `previewMedia` | 预览图片和视频。 | 直连 `wx.previewMedia` | 映射到 `my.previewImage`，并将 `sources.url` 对齐到 `urls` | 映射到 `tt.previewImage`，并将 `sources.url` 对齐到 `urls` | ⚠️ |
| `createInterstitialAd` | 创建插屏广告实例。 | 直连 `wx.createInterstitialAd` | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId` | 直连 `tt.createInterstitialAd` | ⚠️ |
| `createRewardedVideoAd` | 创建激励视频广告实例。 | 直连 `wx.createRewardedVideoAd` | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId` | 映射到 `tt.createInterstitialAd` | ⚠️ |
| `createLivePlayerContext` | 创建直播播放器上下文。 | 直连 `wx.createLivePlayerContext` | 映射到 `my.createVideoContext` | 直连 `tt.createLivePlayerContext` | ⚠️ |
| `createLivePusherContext` | 创建直播推流上下文。 | 直连 `wx.createLivePusherContext` | 映射到 `my.createVideoContext` | 映射到 `tt.createVideoContext` | ⚠️ |
| `getVideoInfo` | 获取视频详细信息。 | 直连 `wx.getVideoInfo` | 直连 `my.getVideoInfo` | 映射到 `tt.getFileInfo`，并将 `src` 对齐为 `filePath` | ⚠️ |
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
| `setBackgroundColor` | 动态设置窗口背景色。 | 直连 `wx.setBackgroundColor` | 直连 `my.setBackgroundColor` | 映射到 `tt.setNavigationBarColor`，对齐 `backgroundColor/frontColor` | ⚠️ |
| `setBackgroundTextStyle` | 动态设置下拉背景字体样式。 | 直连 `wx.setBackgroundTextStyle` | 直连 `my.setBackgroundTextStyle` | 映射到 `tt.setNavigationBarColor`，将 `textStyle` 对齐到 `frontColor` | ⚠️ |
| `getNetworkType` | 获取网络类型。 | 直连 `wx.getNetworkType` | 直连 `my.getNetworkType` | 映射到 `tt.getSystemInfo`，兜底补齐 `networkType` | ⚠️ |
| `getBatteryInfo` | 异步获取电量信息。 | 直连 `wx.getBatteryInfo` | 直连 `my.getBatteryInfo` | 映射到 `tt.getSystemInfo`，补齐 `level/isCharging` | ⚠️ |
| `getBatteryInfoSync` | 同步获取电量信息。 | 直连 `wx.getBatteryInfoSync` | 直连 `my.getBatteryInfoSync` | 映射到 `tt.getSystemInfoSync`，补齐 `level/isCharging` | ⚠️ |
| `getLogManager` | 获取日志管理器实例。 | 直连 `wx.getLogManager` | 使用内置日志 shim（对齐 `log/info/warn/error`） | 使用内置日志 shim（对齐 `log/info/warn/error`） | ⚠️ |
| `nextTick` | 延迟到下一个 UI 更新时机执行回调。 | 直连 `wx.nextTick` | 使用内置 microtask shim 调度回调 | 使用内置 microtask shim 调度回调 | ⚠️ |
| `onWindowResize` | 监听窗口尺寸变化事件。 | 直连 `wx.onWindowResize` | 使用内置 shim，通过 `my.onAppShow + my.getWindowInfo` 近似监听 | 直连 `tt.onWindowResize` | ⚠️ |
| `offWindowResize` | 取消监听窗口尺寸变化事件。 | 直连 `wx.offWindowResize` | 使用内置 shim，移除 `onWindowResize` 注册回调 | 直连 `tt.offWindowResize` | ⚠️ |
| `reportAnalytics` | 上报分析数据。 | 直连 `wx.reportAnalytics` | 使用内置 no-op shim（保持调用不抛错） | 直连 `tt.reportAnalytics` | ⚠️ |
| `openCustomerServiceChat` | 打开客服会话。 | 直连 `wx.openCustomerServiceChat` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `createVKSession` | 创建视觉识别会话。 | 直连 `wx.createVKSession` | 使用内置 VKSession shim（对齐 `start/stop/destroy`） | 使用内置 VKSession shim（对齐 `start/stop/destroy`） | ⚠️ |
| `compressVideo` | 压缩视频文件。 | 直连 `wx.compressVideo` | 使用内置 shim（回传原始文件路径） | 使用内置 shim（回传原始文件路径） | ⚠️ |
| `openVideoEditor` | 打开视频编辑器。 | 直连 `wx.openVideoEditor` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getShareInfo` | 获取转发详细信息。 | 直连 `wx.getShareInfo` | 使用内置 shim（补齐 `encryptedData/iv`） | 使用内置 shim（补齐 `encryptedData/iv`） | ⚠️ |
| `joinVoIPChat` | 加入音视频通话。 | 直连 `wx.joinVoIPChat` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openDocument` | 打开文档。 | 直连 `wx.openDocument` | 直连 `my.openDocument` | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `saveVideoToPhotosAlbum` | 保存视频到系统相册。 | 直连 `wx.saveVideoToPhotosAlbum` | 直连 `my.saveVideoToPhotosAlbum` | 映射到 `tt.saveImageToPhotosAlbum` | ⚠️ |
| `batchSetStorage` | 批量异步写入缓存。 | 直连 `wx.batchSetStorage` | 使用内置 shim，逐项转调 `my.setStorage` | 使用内置 shim，逐项转调 `tt.setStorage` | ⚠️ |
| `batchGetStorage` | 批量异步读取缓存。 | 直连 `wx.batchGetStorage` | 使用内置 shim，逐项转调 `my.getStorage` | 使用内置 shim，逐项转调 `tt.getStorage` | ⚠️ |
| `batchSetStorageSync` | 批量同步写入缓存。 | 直连 `wx.batchSetStorageSync` | 使用内置 shim，逐项转调 `my.setStorageSync` | 使用内置 shim，逐项转调 `tt.setStorageSync` | ⚠️ |
| `batchGetStorageSync` | 批量同步读取缓存。 | 直连 `wx.batchGetStorageSync` | 使用内置 shim，逐项转调 `my.getStorageSync` | 使用内置 shim，逐项转调 `tt.getStorageSync` | ⚠️ |
| `createCameraContext` | 创建相机上下文对象。 | 直连 `wx.createCameraContext` | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） | ⚠️ |
| `offMemoryWarning` | 取消内存不足告警监听。 | 直连 `wx.offMemoryWarning` | 直连 `my.offMemoryWarning` | 使用内置 shim，配合 `tt.onMemoryWarning` 实现监听解绑 | ⚠️ |
| `cancelIdleCallback` | 取消空闲回调。 | 直连 `wx.cancelIdleCallback` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addCard` | 添加微信卡券。 | 直连 `wx.addCard` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addFileToFavorites` | 添加文件到收藏。 | 直连 `wx.addFileToFavorites` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addPaymentPassFinish` | 添加支付 pass 完成回调。 | 直连 `wx.addPaymentPassFinish` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addPaymentPassGetCertificateData` | 添加支付 pass 证书数据回调。 | 直连 `wx.addPaymentPassGetCertificateData` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addPhoneCalendar` | 添加日历事件。 | 直连 `wx.addPhoneCalendar` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addPhoneContact` | 添加手机联系人。 | 直连 `wx.addPhoneContact` | 直连 `my.addPhoneContact` | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addPhoneRepeatCalendar` | 添加重复日历事件。 | 直连 `wx.addPhoneRepeatCalendar` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `addVideoToFavorites` | 添加视频到收藏。 | 直连 `wx.addVideoToFavorites` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `authorizeForMiniProgram` | 获取小程序授权码。 | 直连 `wx.authorizeForMiniProgram` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `authPrivateMessage` | 校验私密消息。 | 直连 `wx.authPrivateMessage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `bindEmployeeRelation` | 绑定员工关系。 | 直连 `wx.bindEmployeeRelation` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `canAddSecureElementPass` | 检测是否可添加安全元素卡片。 | 直连 `wx.canAddSecureElementPass` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `canvasGetImageData` | 获取 canvas 区域像素数据。 | 直连 `wx.canvasGetImageData` | 使用内置 shim，返回空像素数据结构 | 使用内置 shim，返回空像素数据结构 | ⚠️ |
| `canvasPutImageData` | 将像素数据绘制到 canvas。 | 直连 `wx.canvasPutImageData` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `checkDeviceSupportHevc` | 检测设备是否支持 HEVC 解码。 | 直连 `wx.checkDeviceSupportHevc` | 使用内置 shim，返回默认不支持 | 使用内置 shim，返回默认不支持 | ⚠️ |
| `checkEmployeeRelation` | 查询员工关系绑定状态。 | 直连 `wx.checkEmployeeRelation` | 使用内置 shim，返回未绑定 | 使用内置 shim，返回未绑定 | ⚠️ |
| `checkIsAddedToMyMiniProgram` | 检测是否已添加到我的小程序。 | 直连 `wx.checkIsAddedToMyMiniProgram` | 使用内置 shim，返回未添加 | 使用内置 shim，返回未添加 | ⚠️ |
| `checkIsOpenAccessibility` | 检测系统无障碍是否开启。 | 直连 `wx.checkIsOpenAccessibility` | 使用内置 shim，返回未开启 | 使用内置 shim，返回未开启 | ⚠️ |
| `checkIsPictureInPictureActive` | 检测是否处于画中画状态。 | 直连 `wx.checkIsPictureInPictureActive` | 使用内置 shim，返回未激活 | 使用内置 shim，返回未激活 | ⚠️ |
| `checkIsSoterEnrolledInDevice` | 检测设备是否录入 SOTER 信息。 | 直连 `wx.checkIsSoterEnrolledInDevice` | 使用内置 shim，返回未录入 | 使用内置 shim，返回未录入 | ⚠️ |
| `checkIsSupportSoterAuthentication` | 检测设备是否支持 SOTER 生物认证。 | 直连 `wx.checkIsSupportSoterAuthentication` | 使用内置 shim，返回默认不支持 | 使用内置 shim，返回默认不支持 | ⚠️ |
| `openCard` | 打开卡券详情。 | 直连 `wx.openCard` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openChannelsActivity` | 打开视频号活动页。 | 直连 `wx.openChannelsActivity` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openChannelsEvent` | 打开视频号活动详情。 | 直连 `wx.openChannelsEvent` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openChannelsLive` | 打开视频号直播。 | 直连 `wx.openChannelsLive` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openChannelsLiveNoticeInfo` | 打开视频号直播预告详情。 | 直连 `wx.openChannelsLiveNoticeInfo` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openChannelsUserProfile` | 打开视频号用户主页。 | 直连 `wx.openChannelsUserProfile` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openChatTool` | 打开客服工具页。 | 直连 `wx.openChatTool` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openHKOfflinePayView` | 打开香港线下支付视图。 | 直连 `wx.openHKOfflinePayView` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openInquiriesTopic` | 打开询价话题。 | 直连 `wx.openInquiriesTopic` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openOfficialAccountArticle` | 打开公众号文章。 | 直连 `wx.openOfficialAccountArticle` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openOfficialAccountChat` | 打开公众号会话。 | 直连 `wx.openOfficialAccountChat` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openOfficialAccountProfile` | 打开公众号主页。 | 直连 `wx.openOfficialAccountProfile` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openPrivacyContract` | 打开隐私协议页面。 | 直连 `wx.openPrivacyContract` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openSystemBluetoothSetting` | 打开系统蓝牙设置页面。 | 直连 `wx.openSystemBluetoothSetting` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `reportEvent` | 上报事件埋点。 | 直连 `wx.reportEvent` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `reportMonitor` | 上报监控数据。 | 直连 `wx.reportMonitor` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `reportPerformance` | 上报性能数据。 | 直连 `wx.reportPerformance` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openSingleStickerView` | 打开单个表情贴纸详情。 | 直连 `wx.openSingleStickerView` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openStickerIPView` | 打开表情 IP 页面。 | 直连 `wx.openStickerIPView` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openStickerSetView` | 打开表情包详情页。 | 直连 `wx.openStickerSetView` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openStoreCouponDetail` | 打开小店优惠券详情。 | 直连 `wx.openStoreCouponDetail` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `openStoreOrderDetail` | 打开小店订单详情。 | 直连 `wx.openStoreOrderDetail` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `pauseBackgroundAudio` | 暂停后台音频。 | 直连 `wx.pauseBackgroundAudio` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `pauseVoice` | 暂停播放语音。 | 直连 `wx.pauseVoice` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `playBackgroundAudio` | 播放后台音频。 | 直连 `wx.playBackgroundAudio` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `playVoice` | 播放语音。 | 直连 `wx.playVoice` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `postMessageToReferrerMiniProgram` | 向来源小程序发送消息。 | 直连 `wx.postMessageToReferrerMiniProgram` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `postMessageToReferrerPage` | 向来源页面发送消息。 | 直连 `wx.postMessageToReferrerPage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `preDownloadSubpackage` | 预下载分包。 | 直连 `wx.preDownloadSubpackage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `preloadAssets` | 预加载资源。 | 直连 `wx.preloadAssets` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `preloadSkylineView` | 预加载 Skyline 视图。 | 直连 `wx.preloadSkylineView` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `preloadWebview` | 预加载 WebView 页面。 | 直连 `wx.preloadWebview` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `removeSecureElementPass` | 移除安全元素卡片。 | 直连 `wx.removeSecureElementPass` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `chooseInvoiceTitle` | 选择发票抬头。 | 直连 `wx.chooseInvoiceTitle` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `chooseLicensePlate` | 选择车牌号。 | 直连 `wx.chooseLicensePlate` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `choosePoi` | 选择兴趣点 POI。 | 直连 `wx.choosePoi` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `closeBLEConnection` | 断开低功耗蓝牙连接。 | 直连 `wx.closeBLEConnection` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `createBLEConnection` | 创建低功耗蓝牙连接。 | 直连 `wx.createBLEConnection` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `cropImage` | 裁剪图片。 | 直连 `wx.cropImage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `editImage` | 编辑图片。 | 直连 `wx.editImage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `exitVoIPChat` | 退出音视频通话。 | 直连 `wx.exitVoIPChat` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `faceDetect` | 人脸检测。 | 直连 `wx.faceDetect` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getApiCategory` | 获取 API 分类信息。 | 直连 `wx.getApiCategory` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getBackgroundFetchToken` | 获取后台拉取 token。 | 直连 `wx.getBackgroundFetchToken` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getChannelsLiveInfo` | 获取视频号直播信息。 | 直连 `wx.getChannelsLiveInfo` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getChannelsLiveNoticeInfo` | 获取视频号直播预告信息。 | 直连 `wx.getChannelsLiveNoticeInfo` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getChannelsShareKey` | 获取视频号分享 key。 | 直连 `wx.getChannelsShareKey` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getChatToolInfo` | 获取客服工具信息。 | 直连 `wx.getChatToolInfo` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getCommonConfig` | 获取通用配置。 | 直连 `wx.getCommonConfig` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getGroupEnterInfo` | 获取群聊进入信息。 | 直连 `wx.getGroupEnterInfo` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `getPrivacySetting` | 获取隐私设置。 | 直连 `wx.getPrivacySetting` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `initFaceDetect` | 初始化人脸检测。 | 直连 `wx.initFaceDetect` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `join1v1Chat` | 发起 1v1 通话。 | 直连 `wx.join1v1Chat` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareAppMessageToGroup` | 分享到群聊会话。 | 直连 `wx.shareAppMessageToGroup` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareEmojiToGroup` | 分享到群聊表情。 | 直连 `wx.shareEmojiToGroup` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareFileMessage` | 分享文件消息。 | 直连 `wx.shareFileMessage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareFileToGroup` | 分享文件到群。 | 直连 `wx.shareFileToGroup` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareImageToGroup` | 分享图片到群。 | 直连 `wx.shareImageToGroup` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareToOfficialAccount` | 分享至公众号。 | 直连 `wx.shareToOfficialAccount` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareToWeRun` | 分享至微信运动。 | 直连 `wx.shareToWeRun` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareVideoMessage` | 分享视频消息。 | 直连 `wx.shareVideoMessage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `shareVideoToGroup` | 分享视频到群。 | 直连 `wx.shareVideoToGroup` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `showRedPackage` | 展示红包组件。 | 直连 `wx.showRedPackage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startDeviceMotionListening` | 开始监听设备方向变化。 | 直连 `wx.startDeviceMotionListening` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startHCE` | 启动 HCE 功能。 | 直连 `wx.startHCE` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startLocalServiceDiscovery` | 开始本地服务发现。 | 直连 `wx.startLocalServiceDiscovery` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startLocationUpdate` | 开始持续定位。 | 直连 `wx.startLocationUpdate` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startLocationUpdateBackground` | 开始后台持续定位。 | 直连 `wx.startLocationUpdateBackground` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startRecord` | 开始录音。 | 直连 `wx.startRecord` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `startSoterAuthentication` | 开始 SOTER 认证。 | 直连 `wx.startSoterAuthentication` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopBackgroundAudio` | 停止后台音频。 | 直连 `wx.stopBackgroundAudio` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopDeviceMotionListening` | 停止监听设备方向变化。 | 直连 `wx.stopDeviceMotionListening` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopFaceDetect` | 停止人脸检测。 | 直连 `wx.stopFaceDetect` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `requestCommonPayment` | 发起通用支付请求。 | 直连 `wx.requestCommonPayment` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `requestDeviceVoIP` | 请求设备 VoIP 能力。 | 直连 `wx.requestDeviceVoIP` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `requestMerchantTransfer` | 发起商家转账请求。 | 直连 `wx.requestMerchantTransfer` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `requirePrivacyAuthorize` | 请求隐私授权。 | 直连 `wx.requirePrivacyAuthorize` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `reserveChannelsLive` | 预约视频号直播。 | 直连 `wx.reserveChannelsLive` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `selectGroupMembers` | 选择群成员。 | 直连 `wx.selectGroupMembers` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `sendHCEMessage` | 发送 HCE 消息。 | 直连 `wx.sendHCEMessage` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `sendSms` | 发送短信。 | 直连 `wx.sendSms` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `setBackgroundFetchToken` | 设置后台拉取 token。 | 直连 `wx.setBackgroundFetchToken` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `setEnable1v1Chat` | 设置 1v1 通话可用状态。 | 直连 `wx.setEnable1v1Chat` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `setTopBarText` | 设置顶栏文本。 | 直连 `wx.setTopBarText` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `setWindowSize` | 设置窗口尺寸。 | 直连 `wx.setWindowSize` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopHCE` | 停止 HCE 功能。 | 直连 `wx.stopHCE` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopLocalServiceDiscovery` | 停止本地服务发现。 | 直连 `wx.stopLocalServiceDiscovery` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopLocationUpdate` | 停止持续定位。 | 直连 `wx.stopLocationUpdate` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopRecord` | 停止录音。 | 直连 `wx.stopRecord` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `stopVoice` | 停止播放语音。 | 直连 `wx.stopVoice` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `subscribeVoIPVideoMembers` | 订阅 VoIP 视频成员变化。 | 直连 `wx.subscribeVoIPVideoMembers` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `updateVoIPChatMuteConfig` | 更新 VoIP 静音配置。 | 直连 `wx.updateVoIPChatMuteConfig` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
| `updateWeChatApp` | 拉起微信升级流程。 | 直连 `wx.updateWeChatApp` | 使用内置 no-op shim（保持调用不抛错） | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
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
