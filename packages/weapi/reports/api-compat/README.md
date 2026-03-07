# weapi 三端 API 兼容报告（总览）

- 类型来源：
  - 微信：`miniprogram-api-typings@5.1.1`
  - 支付宝：`@mini-types/alipay@3.0.14`
  - 抖音：`@douyin-microapp/typings@1.3.1`

## 全量统计

| 指标                             | 数值 |
| -------------------------------- | ---: |
| 微信方法数（基准命名）           |  479 |
| 支付宝方法数                     |  283 |
| 抖音方法数                       |  165 |
| 支付宝独有方法数（不在 wx 命名） |   93 |
| 抖音独有方法数（不在 wx 命名）   |   36 |
| 支付宝可按微信命名调用的方法数   |  393 |
| 支付宝语义对齐方法数             |  393 |
| 支付宝 fallback 方法数           |    0 |
| 抖音可按微信命名调用的方法数     |  335 |
| 抖音语义对齐方法数               |  335 |
| 抖音 fallback 方法数             |    0 |
| 三端可调用完全对齐方法数         |  333 |
| 三端语义完全对齐方法数           |  333 |

## 覆盖率

| 平台                          | 可调用 API 数 | 语义对齐 API 数 | fallback API 数 | API 总数 | 可调用覆盖率 | 语义对齐覆盖率 |
| ----------------------------- | ------------: | --------------: | --------------: | -------: | -----------: | -------------: |
| 微信小程序 (`wx`)             |           479 |             479 |               0 |      479 |      100.00% |        100.00% |
| 支付宝小程序 (`my`)           |           393 |             393 |               0 |      479 |       82.05% |         82.05% |
| 抖音小程序 (`tt`)             |           335 |             335 |               0 |      479 |       69.94% |         69.94% |
| 三端可调用完全对齐 (wx/my/tt) |           333 |               - |               - |      479 |       69.52% |              - |
| 三端语义完全对齐 (wx/my/tt)   |             - |             333 |               - |      479 |            - |         69.52% |

## 核心差异映射（手工规则）

| API                                 | 微信策略                                            | 支付宝策略                                                             | 抖音策略                                                               |
| ----------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `showToast`                         | 直连 `wx.showToast`                                 | `title/icon` 映射到 `content/type` 后调用 `my.showToast`               | `icon=error` 映射为 `fail` 后调用 `tt.showToast`                       |
| `showLoading`                       | 直连 `wx.showLoading`                               | `title` 映射到 `content` 后调用 `my.showLoading`                       | 直连 `tt.showLoading`                                                  |
| `showActionSheet`                   | 直连 `wx.showActionSheet`                           | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐                    | 优先直连 `tt.showActionSheet`；缺失时降级到 `tt.showModal` shim        |
| `showModal`                         | 直连 `wx.showModal`                                 | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果                       | 直连 `tt.showModal`                                                    |
| `chooseImage`                       | 直连 `wx.chooseImage`                               | 返回值 `apFilePaths` 映射到 `tempFilePaths`                            | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底           |
| `chooseMedia`                       | 直连 `wx.chooseMedia`                               | 映射到 `my.chooseImage`，并补齐 `tempFiles[].tempFilePath/fileType`    | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType`      |
| `chooseMessageFile`                 | 直连 `wx.chooseMessageFile`                         | 映射到 `my.chooseImage`，并补齐 `tempFiles[].path/name`                | 映射到 `tt.chooseImage`，并补齐 `tempFiles[].path/name`                |
| `getFuzzyLocation`                  | 直连 `wx.getFuzzyLocation`                          | 映射到 `my.getLocation`                                                | 映射到 `tt.getLocation`                                                |
| `previewMedia`                      | 直连 `wx.previewMedia`                              | 映射到 `my.previewImage`，并将 `sources.url` 对齐到 `urls`             | 映射到 `tt.previewImage`，并将 `sources.url` 对齐到 `urls`             |
| `createInterstitialAd`              | 直连 `wx.createInterstitialAd`                      | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`                    | 直连 `tt.createInterstitialAd`                                         |
| `createRewardedVideoAd`             | 直连 `wx.createRewardedVideoAd`                     | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`                    | 映射到 `tt.createInterstitialAd`                                       |
| `createLivePlayerContext`           | 直连 `wx.createLivePlayerContext`                   | 映射到 `my.createVideoContext`                                         | 直连 `tt.createLivePlayerContext`                                      |
| `createLivePusherContext`           | 直连 `wx.createLivePusherContext`                   | 映射到 `my.createVideoContext`                                         | 映射到 `tt.createVideoContext`                                         |
| `getVideoInfo`                      | 直连 `wx.getVideoInfo`                              | 直连 `my.getVideoInfo`                                                 | 映射到 `tt.getFileInfo`，并将 `src` 对齐为 `filePath`                  |
| `saveFile`                          | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath`     | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath`       |
| `setClipboardData`                  | 直连 `wx.setClipboardData`                          | 转调 `my.setClipboard` 并映射 `data` → `text`                          | 直连 `tt.setClipboardData`                                             |
| `getClipboardData`                  | 直连 `wx.getClipboardData`                          | 转调 `my.getClipboard` 并映射 `text` → `data`                          | 直连 `tt.getClipboardData`                                             |
| `chooseAddress`                     | 直连 `wx.chooseAddress`                             | 映射到 `my.getAddress`                                                 | 直连 `tt.chooseAddress`                                                |
| `createAudioContext`                | 直连 `wx.createAudioContext`                        | 映射到 `my.createInnerAudioContext`                                    | 映射到 `tt.createInnerAudioContext`                                    |
| `createWebAudioContext`             | 直连 `wx.createWebAudioContext`                     | 映射到 `my.createInnerAudioContext`                                    | 映射到 `tt.createInnerAudioContext`                                    |
| `getSystemInfoAsync`                | 直连 `wx.getSystemInfoAsync`                        | 映射到 `my.getSystemInfo`                                              | 映射到 `tt.getSystemInfo`                                              |
| `openAppAuthorizeSetting`           | 直连 `wx.openAppAuthorizeSetting`                   | 映射到 `my.openSetting`                                                | 映射到 `tt.openSetting`                                                |
| `pluginLogin`                       | 直连 `wx.pluginLogin`                               | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段                        | 映射到 `tt.login`                                                      |
| `login`                             | 直连 `wx.login`                                     | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段                        | 直连 `tt.login`                                                        |
| `authorize`                         | 直连 `wx.authorize`                                 | 映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数               | 直连 `tt.authorize`                                                    |
| `checkSession`                      | 直连 `wx.checkSession`                              | 映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok`              | 直连 `tt.checkSession`                                                 |
| `requestSubscribeDeviceMessage`     | 直连 `wx.requestSubscribeDeviceMessage`             | 映射到 `my.requestSubscribeMessage`                                    | 映射到 `tt.requestSubscribeMessage`                                    |
| `requestSubscribeEmployeeMessage`   | 直连 `wx.requestSubscribeEmployeeMessage`           | 映射到 `my.requestSubscribeMessage`                                    | 映射到 `tt.requestSubscribeMessage`                                    |
| `restartMiniProgram`                | 直连 `wx.restartMiniProgram`                        | 映射到 `my.reLaunch`                                                   | 映射到 `tt.reLaunch`                                                   |
| `scanCode`                          | 直连 `wx.scanCode`                                  | 映射到 `my.scan`                                                       | 直连 `tt.scanCode`                                                     |
| `requestPayment`                    | 直连 `wx.requestPayment`                            | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requestOrderPayment`               | 直连 `wx.requestOrderPayment`                       | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requestPluginPayment`              | 直连 `wx.requestPluginPayment`                      | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requestVirtualPayment`             | 直连 `wx.requestVirtualPayment`                     | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `showShareImageMenu`                | 直连 `wx.showShareImageMenu`                        | 映射到 `my.showSharePanel`                                             | 映射到 `tt.showShareMenu`                                              |
| `updateShareMenu`                   | 直连 `wx.updateShareMenu`                           | 映射到 `my.showSharePanel`                                             | 映射到 `tt.showShareMenu`                                              |
| `openEmbeddedMiniProgram`           | 直连 `wx.openEmbeddedMiniProgram`                   | 映射到 `my.navigateToMiniProgram`                                      | 映射到 `tt.navigateToMiniProgram`                                      |
| `saveFileToDisk`                    | 直连 `wx.saveFileToDisk`                            | 直连 `my.saveFileToDisk`                                               | 映射到 `tt.saveFile`                                                   |
| `getEnterOptionsSync`               | 直连 `wx.getEnterOptionsSync`                       | 直连 `my.getEnterOptionsSync`                                          | 映射到 `tt.getLaunchOptionsSync`                                       |
| `getSystemSetting`                  | 直连 `wx.getSystemSetting`                          | 直连 `my.getSystemSetting`                                             | 映射到 `tt.getSetting`                                                 |
| `getUserProfile`                    | 直连 `wx.getUserProfile`                            | 映射到 `my.getOpenUserInfo`                                            | 直连 `tt.getUserProfile`                                               |
| `getUserInfo`                       | 直连 `wx.getUserInfo`                               | 映射到 `my.getOpenUserInfo`                                            | 直连 `tt.getUserInfo`                                                  |
| `getAppAuthorizeSetting`            | 直连 `wx.getAppAuthorizeSetting`                    | 直连 `my.getAppAuthorizeSetting`                                       | 映射到 `tt.getSetting`                                                 |
| `getAppBaseInfo`                    | 直连 `wx.getAppBaseInfo`                            | 直连 `my.getAppBaseInfo`                                               | 映射到 `tt.getEnvInfoSync`                                             |
| `chooseVideo`                       | 直连 `wx.chooseVideo`                               | 直连 `my.chooseVideo`                                                  | 映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构       |
| `hideHomeButton`                    | 直连 `wx.hideHomeButton`                            | 映射到 `my.hideBackHome`                                               | 直连 `tt.hideHomeButton`                                               |
| `getWindowInfo`                     | 直连 `wx.getWindowInfo`                             | 直连 `my.getWindowInfo`                                                | 映射到 `tt.getSystemInfo`，并提取窗口字段                              |
| `getDeviceInfo`                     | 直连 `wx.getDeviceInfo`                             | 映射到 `my.getSystemInfo`，并提取设备字段                              | 映射到 `tt.getSystemInfo`，并提取设备字段                              |
| `getAccountInfoSync`                | 直连 `wx.getAccountInfoSync`                        | 直连 `my.getAccountInfoSync`                                           | 映射到 `tt.getEnvInfoSync`，并对齐账号字段结构                         |
| `setBackgroundColor`                | 直连 `wx.setBackgroundColor`                        | 直连 `my.setBackgroundColor`                                           | 映射到 `tt.setNavigationBarColor`，对齐 `backgroundColor/frontColor`   |
| `setBackgroundTextStyle`            | 直连 `wx.setBackgroundTextStyle`                    | 直连 `my.setBackgroundTextStyle`                                       | 映射到 `tt.setNavigationBarColor`，将 `textStyle` 对齐到 `frontColor`  |
| `getNetworkType`                    | 直连 `wx.getNetworkType`                            | 直连 `my.getNetworkType`                                               | 映射到 `tt.getSystemInfo`，兜底补齐 `networkType`                      |
| `getBatteryInfo`                    | 直连 `wx.getBatteryInfo`                            | 直连 `my.getBatteryInfo`                                               | 映射到 `tt.getSystemInfo`，补齐 `level/isCharging`                     |
| `getBatteryInfoSync`                | 直连 `wx.getBatteryInfoSync`                        | 直连 `my.getBatteryInfoSync`                                           | 映射到 `tt.getSystemInfoSync`，补齐 `level/isCharging`                 |
| `getLogManager`                     | 直连 `wx.getLogManager`                             | 使用内置日志 shim（对齐 `log/info/warn/error`）                        | 使用内置日志 shim（对齐 `log/info/warn/error`）                        |
| `nextTick`                          | 直连 `wx.nextTick`                                  | 使用内置 microtask shim 调度回调                                       | 使用内置 microtask shim 调度回调                                       |
| `onWindowResize`                    | 直连 `wx.onWindowResize`                            | 使用内置 shim，通过 `my.onAppShow + my.getWindowInfo` 近似监听         | 直连 `tt.onWindowResize`                                               |
| `offWindowResize`                   | 直连 `wx.offWindowResize`                           | 使用内置 shim，移除 `onWindowResize` 注册回调                          | 直连 `tt.offWindowResize`                                              |
| `reportAnalytics`                   | 直连 `wx.reportAnalytics`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 直连 `tt.reportAnalytics`                                              |
| `openCustomerServiceChat`           | 直连 `wx.openCustomerServiceChat`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createVKSession`                   | 直连 `wx.createVKSession`                           | 使用内置 VKSession shim（对齐 `start/stop/destroy`）                   | 使用内置 VKSession shim（对齐 `start/stop/destroy`）                   |
| `compressVideo`                     | 直连 `wx.compressVideo`                             | 使用内置 shim（回传原始文件路径）                                      | 使用内置 shim（回传原始文件路径）                                      |
| `openVideoEditor`                   | 直连 `wx.openVideoEditor`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getShareInfo`                      | 直连 `wx.getShareInfo`                              | 使用内置 shim（补齐 `encryptedData/iv`）                               | 使用内置 shim（补齐 `encryptedData/iv`）                               |
| `joinVoIPChat`                      | 直连 `wx.joinVoIPChat`                              | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openDocument`                      | 直连 `wx.openDocument`                              | 直连 `my.openDocument`                                                 | 使用内置 no-op shim（保持调用不抛错）                                  |
| `saveVideoToPhotosAlbum`            | 直连 `wx.saveVideoToPhotosAlbum`                    | 直连 `my.saveVideoToPhotosAlbum`                                       | 映射到 `tt.saveImageToPhotosAlbum`                                     |
| `batchSetStorage`                   | 直连 `wx.batchSetStorage`                           | 使用内置 shim，逐项转调 `my.setStorage`                                | 使用内置 shim，逐项转调 `tt.setStorage`                                |
| `batchGetStorage`                   | 直连 `wx.batchGetStorage`                           | 使用内置 shim，逐项转调 `my.getStorage`                                | 使用内置 shim，逐项转调 `tt.getStorage`                                |
| `batchSetStorageSync`               | 直连 `wx.batchSetStorageSync`                       | 使用内置 shim，逐项转调 `my.setStorageSync`                            | 使用内置 shim，逐项转调 `tt.setStorageSync`                            |
| `batchGetStorageSync`               | 直连 `wx.batchGetStorageSync`                       | 使用内置 shim，逐项转调 `my.getStorageSync`                            | 使用内置 shim，逐项转调 `tt.getStorageSync`                            |
| `createCameraContext`               | 直连 `wx.createCameraContext`                       | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） |
| `offMemoryWarning`                  | 直连 `wx.offMemoryWarning`                          | 直连 `my.offMemoryWarning`                                             | 使用内置 shim，配合 `tt.onMemoryWarning` 实现监听解绑                  |
| `cancelIdleCallback`                | 直连 `wx.cancelIdleCallback`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addCard`                           | 直连 `wx.addCard`                                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addFileToFavorites`                | 直连 `wx.addFileToFavorites`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPaymentPassFinish`              | 直连 `wx.addPaymentPassFinish`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPaymentPassGetCertificateData`  | 直连 `wx.addPaymentPassGetCertificateData`          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneCalendar`                  | 直连 `wx.addPhoneCalendar`                          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneContact`                   | 直连 `wx.addPhoneContact`                           | 直连 `my.addPhoneContact`                                              | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneRepeatCalendar`            | 直连 `wx.addPhoneRepeatCalendar`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addVideoToFavorites`               | 直连 `wx.addVideoToFavorites`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `authorizeForMiniProgram`           | 直连 `wx.authorizeForMiniProgram`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `authPrivateMessage`                | 直连 `wx.authPrivateMessage`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `bindEmployeeRelation`              | 直连 `wx.bindEmployeeRelation`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canAddSecureElementPass`           | 直连 `wx.canAddSecureElementPass`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canvasGetImageData`                | 直连 `wx.canvasGetImageData`                        | 使用内置 shim，返回空像素数据结构                                      | 使用内置 shim，返回空像素数据结构                                      |
| `canvasPutImageData`                | 直连 `wx.canvasPutImageData`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `checkDeviceSupportHevc`            | 直连 `wx.checkDeviceSupportHevc`                    | 使用内置 shim，返回默认不支持                                          | 使用内置 shim，返回默认不支持                                          |
| `checkEmployeeRelation`             | 直连 `wx.checkEmployeeRelation`                     | 使用内置 shim，返回未绑定                                              | 使用内置 shim，返回未绑定                                              |
| `checkIsAddedToMyMiniProgram`       | 直连 `wx.checkIsAddedToMyMiniProgram`               | 使用内置 shim，返回未添加                                              | 使用内置 shim，返回未添加                                              |
| `checkIsOpenAccessibility`          | 直连 `wx.checkIsOpenAccessibility`                  | 使用内置 shim，返回未开启                                              | 使用内置 shim，返回未开启                                              |
| `checkIsPictureInPictureActive`     | 直连 `wx.checkIsPictureInPictureActive`             | 使用内置 shim，返回未激活                                              | 使用内置 shim，返回未激活                                              |
| `checkIsSoterEnrolledInDevice`      | 直连 `wx.checkIsSoterEnrolledInDevice`              | 使用内置 shim，返回未录入                                              | 使用内置 shim，返回未录入                                              |
| `checkIsSupportSoterAuthentication` | 直连 `wx.checkIsSupportSoterAuthentication`         | 使用内置 shim，返回默认不支持                                          | 使用内置 shim，返回默认不支持                                          |
| `openCard`                          | 直连 `wx.openCard`                                  | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsActivity`              | 直连 `wx.openChannelsActivity`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsEvent`                 | 直连 `wx.openChannelsEvent`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsLive`                  | 直连 `wx.openChannelsLive`                          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsLiveNoticeInfo`        | 直连 `wx.openChannelsLiveNoticeInfo`                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsUserProfile`           | 直连 `wx.openChannelsUserProfile`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChatTool`                      | 直连 `wx.openChatTool`                              | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openHKOfflinePayView`              | 直连 `wx.openHKOfflinePayView`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openInquiriesTopic`                | 直连 `wx.openInquiriesTopic`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountArticle`        | 直连 `wx.openOfficialAccountArticle`                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountChat`           | 直连 `wx.openOfficialAccountChat`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountProfile`        | 直连 `wx.openOfficialAccountProfile`                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openPrivacyContract`               | 直连 `wx.openPrivacyContract`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openSystemBluetoothSetting`        | 直连 `wx.openSystemBluetoothSetting`                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportEvent`                       | 直连 `wx.reportEvent`                               | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportMonitor`                     | 直连 `wx.reportMonitor`                             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportPerformance`                 | 直连 `wx.reportPerformance`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openSingleStickerView`             | 直连 `wx.openSingleStickerView`                     | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStickerIPView`                 | 直连 `wx.openStickerIPView`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStickerSetView`                | 直连 `wx.openStickerSetView`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStoreCouponDetail`             | 直连 `wx.openStoreCouponDetail`                     | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStoreOrderDetail`              | 直连 `wx.openStoreOrderDetail`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pauseBackgroundAudio`              | 直连 `wx.pauseBackgroundAudio`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pauseVoice`                        | 直连 `wx.pauseVoice`                                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `playBackgroundAudio`               | 直连 `wx.playBackgroundAudio`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `playVoice`                         | 直连 `wx.playVoice`                                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `postMessageToReferrerMiniProgram`  | 直连 `wx.postMessageToReferrerMiniProgram`          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `postMessageToReferrerPage`         | 直连 `wx.postMessageToReferrerPage`                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preDownloadSubpackage`             | 直连 `wx.preDownloadSubpackage`                     | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadAssets`                     | 直连 `wx.preloadAssets`                             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadSkylineView`                | 直连 `wx.preloadSkylineView`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadWebview`                    | 直连 `wx.preloadWebview`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `removeSecureElementPass`           | 直连 `wx.removeSecureElementPass`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseInvoiceTitle`                | 直连 `wx.chooseInvoiceTitle`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseLicensePlate`                | 直连 `wx.chooseLicensePlate`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `choosePoi`                         | 直连 `wx.choosePoi`                                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `closeBLEConnection`                | 直连 `wx.closeBLEConnection`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createBLEConnection`               | 直连 `wx.createBLEConnection`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `cropImage`                         | 直连 `wx.cropImage`                                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `editImage`                         | 直连 `wx.editImage`                                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `exitVoIPChat`                      | 直连 `wx.exitVoIPChat`                              | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `faceDetect`                        | 直连 `wx.faceDetect`                                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getApiCategory`                    | 直连 `wx.getApiCategory`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getBackgroundFetchToken`           | 直连 `wx.getBackgroundFetchToken`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsLiveInfo`               | 直连 `wx.getChannelsLiveInfo`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsLiveNoticeInfo`         | 直连 `wx.getChannelsLiveNoticeInfo`                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsShareKey`               | 直连 `wx.getChannelsShareKey`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChatToolInfo`                   | 直连 `wx.getChatToolInfo`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getCommonConfig`                   | 直连 `wx.getCommonConfig`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getGroupEnterInfo`                 | 直连 `wx.getGroupEnterInfo`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getPrivacySetting`                 | 直连 `wx.getPrivacySetting`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `initFaceDetect`                    | 直连 `wx.initFaceDetect`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `join1v1Chat`                       | 直连 `wx.join1v1Chat`                               | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareAppMessageToGroup`            | 直连 `wx.shareAppMessageToGroup`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareEmojiToGroup`                 | 直连 `wx.shareEmojiToGroup`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareFileMessage`                  | 直连 `wx.shareFileMessage`                          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareFileToGroup`                  | 直连 `wx.shareFileToGroup`                          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareImageToGroup`                 | 直连 `wx.shareImageToGroup`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareToOfficialAccount`            | 直连 `wx.shareToOfficialAccount`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareToWeRun`                      | 直连 `wx.shareToWeRun`                              | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareVideoMessage`                 | 直连 `wx.shareVideoMessage`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareVideoToGroup`                 | 直连 `wx.shareVideoToGroup`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `showRedPackage`                    | 直连 `wx.showRedPackage`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startDeviceMotionListening`        | 直连 `wx.startDeviceMotionListening`                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startHCE`                          | 直连 `wx.startHCE`                                  | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocalServiceDiscovery`        | 直连 `wx.startLocalServiceDiscovery`                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocationUpdate`               | 直连 `wx.startLocationUpdate`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocationUpdateBackground`     | 直连 `wx.startLocationUpdateBackground`             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startRecord`                       | 直连 `wx.startRecord`                               | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startSoterAuthentication`          | 直连 `wx.startSoterAuthentication`                  | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopBackgroundAudio`               | 直连 `wx.stopBackgroundAudio`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopDeviceMotionListening`         | 直连 `wx.stopDeviceMotionListening`                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopFaceDetect`                    | 直连 `wx.stopFaceDetect`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestCommonPayment`              | 直连 `wx.requestCommonPayment`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestDeviceVoIP`                 | 直连 `wx.requestDeviceVoIP`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestMerchantTransfer`           | 直连 `wx.requestMerchantTransfer`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requirePrivacyAuthorize`           | 直连 `wx.requirePrivacyAuthorize`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reserveChannelsLive`               | 直连 `wx.reserveChannelsLive`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `selectGroupMembers`                | 直连 `wx.selectGroupMembers`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendHCEMessage`                    | 直连 `wx.sendHCEMessage`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendSms`                           | 直连 `wx.sendSms`                                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setBackgroundFetchToken`           | 直连 `wx.setBackgroundFetchToken`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setEnable1v1Chat`                  | 直连 `wx.setEnable1v1Chat`                          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setTopBarText`                     | 直连 `wx.setTopBarText`                             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setWindowSize`                     | 直连 `wx.setWindowSize`                             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopHCE`                           | 直连 `wx.stopHCE`                                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopLocalServiceDiscovery`         | 直连 `wx.stopLocalServiceDiscovery`                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopLocationUpdate`                | 直连 `wx.stopLocationUpdate`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopRecord`                        | 直连 `wx.stopRecord`                                | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopVoice`                         | 直连 `wx.stopVoice`                                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `subscribeVoIPVideoMembers`         | 直连 `wx.subscribeVoIPVideoMembers`                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `updateVoIPChatMuteConfig`          | 直连 `wx.updateVoIPChatMuteConfig`                  | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `updateWeChatApp`                   | 直连 `wx.updateWeChatApp`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getBackgroundAudioPlayerState`     | 直连 `wx.getBackgroundAudioPlayerState`             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getDeviceBenchmarkInfo`            | 直连 `wx.getDeviceBenchmarkInfo`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getDeviceVoIPList`                 | 直连 `wx.getDeviceVoIPList`                         | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getHCEState`                       | 直连 `wx.getHCEState`                               | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getInferenceEnvInfo`               | 直连 `wx.getInferenceEnvInfo`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getNFCAdapter`                     | 直连 `wx.getNFCAdapter`                             | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getPerformance`                    | 直连 `wx.getPerformance`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRandomValues`                   | 直连 `wx.getRandomValues`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRealtimeLogManager`             | 直连 `wx.getRealtimeLogManager`                     | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRendererUserAgent`              | 直连 `wx.getRendererUserAgent`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getScreenRecordingState`           | 直连 `wx.getScreenRecordingState`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSecureElementPasses`            | 直连 `wx.getSecureElementPasses`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSelectedTextRange`              | 直连 `wx.getSelectedTextRange`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getShowSplashAdStatus`             | 直连 `wx.getShowSplashAdStatus`                     | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSkylineInfo`                    | 直连 `wx.getSkylineInfo`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getUserCryptoManager`              | 直连 `wx.getUserCryptoManager`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getWeRunData`                      | 直连 `wx.getWeRunData`                              | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getXrFrameSystem`                  | 直连 `wx.getXrFrameSystem`                          | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `isBluetoothDevicePaired`           | 直连 `wx.isBluetoothDevicePaired`                   | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `isVKSupport`                       | 直连 `wx.isVKSupport`                               | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createBLEPeripheralServer`         | 直连 `wx.createBLEPeripheralServer`                 | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createBufferURL`                   | 直连 `wx.createBufferURL`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createCacheManager`                | 直连 `wx.createCacheManager`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createGlobalPayment`               | 直连 `wx.createGlobalPayment`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createInferenceSession`            | 直连 `wx.createInferenceSession`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createMediaAudioPlayer`            | 直连 `wx.createMediaAudioPlayer`                    | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createMediaContainer`              | 直连 `wx.createMediaContainer`                      | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createMediaRecorder`               | 直连 `wx.createMediaRecorder`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createTCPSocket`                   | 直连 `wx.createTCPSocket`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createUDPSocket`                   | 直连 `wx.createUDPSocket`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createVideoDecoder`                | 直连 `wx.createVideoDecoder`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `loadBuiltInFontFace`               | 直连 `wx.loadBuiltInFontFace`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `notifyGroupMembers`                | 直连 `wx.notifyGroupMembers`                        | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestIdleCallback`               | 直连 `wx.requestIdleCallback`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `revokeBufferURL`                   | 直连 `wx.revokeBufferURL`                           | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `rewriteRoute`                      | 直连 `wx.rewriteRoute`                              | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `seekBackgroundAudio`               | 直连 `wx.seekBackgroundAudio`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setEnableDebug`                    | 直连 `wx.setEnableDebug`                            | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setInnerAudioOption`               | 直连 `wx.setInnerAudioOption`                       | 使用内置 no-op shim（保持调用不抛错）                                  | 使用内置 no-op shim（保持调用不抛错）                                  |

## 已执行验证

- `pnpm --filter @wevu/api build`
- `pnpm --filter @wevu/api test`
- `pnpm --filter @wevu/api test:types`

## 目录

- [01-overview.md](./01-overview.md)
- [02-wx-method-list.md](./02-wx-method-list.md)
- [03-alipay-compat-matrix.md](./03-alipay-compat-matrix.md)
- [04-douyin-compat-matrix.md](./04-douyin-compat-matrix.md)
- [05-gap-notes.md](./05-gap-notes.md)
- [06-platform-only-methods.md](./06-platform-only-methods.md)
