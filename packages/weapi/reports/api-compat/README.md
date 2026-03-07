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
| 支付宝可按微信命名调用的方法数   |  198 |
| 支付宝语义对齐方法数             |  198 |
| 支付宝 fallback 方法数           |    0 |
| 抖音可按微信命名调用的方法数     |  132 |
| 抖音语义对齐方法数               |  132 |
| 抖音 fallback 方法数             |    0 |
| 三端可调用完全对齐方法数         |  118 |
| 三端语义完全对齐方法数           |  118 |

## 覆盖率

| 平台                          | 可调用 API 数 | 语义对齐 API 数 | fallback API 数 | API 总数 | 可调用覆盖率 | 语义对齐覆盖率 |
| ----------------------------- | ------------: | --------------: | --------------: | -------: | -----------: | -------------: |
| 微信小程序 (`wx`)             |           479 |             479 |               0 |      479 |      100.00% |        100.00% |
| 支付宝小程序 (`my`)           |           198 |             198 |               0 |      479 |       41.34% |         41.34% |
| 抖音小程序 (`tt`)             |           132 |             132 |               0 |      479 |       27.56% |         27.56% |
| 三端可调用完全对齐 (wx/my/tt) |           118 |               - |               - |      479 |       24.63% |              - |
| 三端语义完全对齐 (wx/my/tt)   |             - |             118 |               - |      479 |            - |         24.63% |

## 核心差异映射（手工规则）

| API                                 | 微信策略                                            | 支付宝策略                                                         | 抖音策略                                                          |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `showToast`                         | 直连 `wx.showToast`                                 | `title/icon` 映射到 `content/type` 后调用 `my.showToast`           | `icon=error` 映射为 `fail` 后调用 `tt.showToast`                  |
| `showLoading`                       | 直连 `wx.showLoading`                               | `title` 映射到 `content` 后调用 `my.showLoading`                   | 直连 `tt.showLoading`                                             |
| `showActionSheet`                   | 直连 `wx.showActionSheet`                           | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐                | 直连 `tt.showActionSheet`；缺失时按 unsupported 报错              |
| `showModal`                         | 直连 `wx.showModal`                                 | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果                   | 直连 `tt.showModal`                                               |
| `chooseImage`                       | 直连 `wx.chooseImage`                               | 返回值 `apFilePaths` 映射到 `tempFilePaths`                        | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底      |
| `chooseMedia`                       | 直连 `wx.chooseMedia`                               | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType` |
| `chooseMessageFile`                 | 直连 `wx.chooseMessageFile`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getFuzzyLocation`                  | 直连 `wx.getFuzzyLocation`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `previewMedia`                      | 直连 `wx.previewMedia`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createInterstitialAd`              | 直连 `wx.createInterstitialAd`                      | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.createInterstitialAd`                                    |
| `createRewardedVideoAd`             | 直连 `wx.createRewardedVideoAd`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createLivePlayerContext`           | 直连 `wx.createLivePlayerContext`                   | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.createLivePlayerContext`                                 |
| `createLivePusherContext`           | 直连 `wx.createLivePusherContext`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getVideoInfo`                      | 直连 `wx.getVideoInfo`                              | 直连 `my.getVideoInfo`                                             | 无同等 API，调用时按 unsupported 报错                             |
| `saveFile`                          | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath`  |
| `setClipboardData`                  | 直连 `wx.setClipboardData`                          | 转调 `my.setClipboard` 并映射 `data` → `text`                      | 直连 `tt.setClipboardData`                                        |
| `getClipboardData`                  | 直连 `wx.getClipboardData`                          | 转调 `my.getClipboard` 并映射 `text` → `data`                      | 直连 `tt.getClipboardData`                                        |
| `chooseAddress`                     | 直连 `wx.chooseAddress`                             | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.chooseAddress`                                           |
| `createAudioContext`                | 直连 `wx.createAudioContext`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createWebAudioContext`             | 直连 `wx.createWebAudioContext`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getSystemInfoAsync`                | 直连 `wx.getSystemInfoAsync`                        | 映射到 `my.getSystemInfo`                                          | 映射到 `tt.getSystemInfo`                                         |
| `openAppAuthorizeSetting`           | 直连 `wx.openAppAuthorizeSetting`                   | 映射到 `my.openSetting`                                            | 映射到 `tt.openSetting`                                           |
| `pluginLogin`                       | 直连 `wx.pluginLogin`                               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `login`                             | 直连 `wx.login`                                     | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.login`                                                   |
| `authorize`                         | 直连 `wx.authorize`                                 | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.authorize`                                               |
| `checkSession`                      | 直连 `wx.checkSession`                              | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.checkSession`                                            |
| `requestSubscribeDeviceMessage`     | 直连 `wx.requestSubscribeDeviceMessage`             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestSubscribeEmployeeMessage`   | 直连 `wx.requestSubscribeEmployeeMessage`           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `restartMiniProgram`                | 直连 `wx.restartMiniProgram`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `scanCode`                          | 直连 `wx.scanCode`                                  | 映射到 `my.scan`                                                   | 直连 `tt.scanCode`                                                |
| `requestPayment`                    | 直连 `wx.requestPayment`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestOrderPayment`               | 直连 `wx.requestOrderPayment`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestPluginPayment`              | 直连 `wx.requestPluginPayment`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestVirtualPayment`             | 直连 `wx.requestVirtualPayment`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `showShareImageMenu`                | 直连 `wx.showShareImageMenu`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `updateShareMenu`                   | 直连 `wx.updateShareMenu`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openEmbeddedMiniProgram`           | 直连 `wx.openEmbeddedMiniProgram`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `saveFileToDisk`                    | 直连 `wx.saveFileToDisk`                            | 直连 `my.saveFileToDisk`                                           | 无同等 API，调用时按 unsupported 报错                             |
| `getEnterOptionsSync`               | 直连 `wx.getEnterOptionsSync`                       | 直连 `my.getEnterOptionsSync`                                      | 映射到 `tt.getLaunchOptionsSync`                                  |
| `getSystemSetting`                  | 直连 `wx.getSystemSetting`                          | 直连 `my.getSystemSetting`                                         | 无同等 API，调用时按 unsupported 报错                             |
| `getUserProfile`                    | 直连 `wx.getUserProfile`                            | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.getUserProfile`                                          |
| `getUserInfo`                       | 直连 `wx.getUserInfo`                               | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.getUserInfo`                                             |
| `getAppAuthorizeSetting`            | 直连 `wx.getAppAuthorizeSetting`                    | 直连 `my.getAppAuthorizeSetting`                                   | 无同等 API，调用时按 unsupported 报错                             |
| `getAppBaseInfo`                    | 直连 `wx.getAppBaseInfo`                            | 直连 `my.getAppBaseInfo`                                           | 无同等 API，调用时按 unsupported 报错                             |
| `chooseVideo`                       | 直连 `wx.chooseVideo`                               | 直连 `my.chooseVideo`                                              | 无同等 API，调用时按 unsupported 报错                             |
| `hideHomeButton`                    | 直连 `wx.hideHomeButton`                            | 映射到 `my.hideBackHome`                                           | 直连 `tt.hideHomeButton`                                          |
| `getWindowInfo`                     | 直连 `wx.getWindowInfo`                             | 直连 `my.getWindowInfo`                                            | 无同等 API，调用时按 unsupported 报错                             |
| `getDeviceInfo`                     | 直连 `wx.getDeviceInfo`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getAccountInfoSync`                | 直连 `wx.getAccountInfoSync`                        | 直连 `my.getAccountInfoSync`                                       | 无同等 API，调用时按 unsupported 报错                             |
| `setBackgroundColor`                | 直连 `wx.setBackgroundColor`                        | 直连 `my.setBackgroundColor`                                       | 无同等 API，调用时按 unsupported 报错                             |
| `setBackgroundTextStyle`            | 直连 `wx.setBackgroundTextStyle`                    | 直连 `my.setBackgroundTextStyle`                                   | 无同等 API，调用时按 unsupported 报错                             |
| `getNetworkType`                    | 直连 `wx.getNetworkType`                            | 直连 `my.getNetworkType`                                           | 无同等 API，调用时按 unsupported 报错                             |
| `getBatteryInfo`                    | 直连 `wx.getBatteryInfo`                            | 直连 `my.getBatteryInfo`                                           | 无同等 API，调用时按 unsupported 报错                             |
| `getBatteryInfoSync`                | 直连 `wx.getBatteryInfoSync`                        | 直连 `my.getBatteryInfoSync`                                       | 无同等 API，调用时按 unsupported 报错                             |
| `getLogManager`                     | 直连 `wx.getLogManager`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `nextTick`                          | 直连 `wx.nextTick`                                  | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `onWindowResize`                    | 直连 `wx.onWindowResize`                            | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.onWindowResize`                                          |
| `offWindowResize`                   | 直连 `wx.offWindowResize`                           | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.offWindowResize`                                         |
| `reportAnalytics`                   | 直连 `wx.reportAnalytics`                           | 无同等 API，调用时按 unsupported 报错                              | 直连 `tt.reportAnalytics`                                         |
| `openCustomerServiceChat`           | 直连 `wx.openCustomerServiceChat`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createVKSession`                   | 直连 `wx.createVKSession`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `compressVideo`                     | 直连 `wx.compressVideo`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openVideoEditor`                   | 直连 `wx.openVideoEditor`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getShareInfo`                      | 直连 `wx.getShareInfo`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `joinVoIPChat`                      | 直连 `wx.joinVoIPChat`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openDocument`                      | 直连 `wx.openDocument`                              | 直连 `my.openDocument`                                             | 无同等 API，调用时按 unsupported 报错                             |
| `saveVideoToPhotosAlbum`            | 直连 `wx.saveVideoToPhotosAlbum`                    | 直连 `my.saveVideoToPhotosAlbum`                                   | 无同等 API，调用时按 unsupported 报错                             |
| `batchSetStorage`                   | 直连 `wx.batchSetStorage`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `batchGetStorage`                   | 直连 `wx.batchGetStorage`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `batchSetStorageSync`               | 直连 `wx.batchSetStorageSync`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `batchGetStorageSync`               | 直连 `wx.batchGetStorageSync`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createCameraContext`               | 直连 `wx.createCameraContext`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `offMemoryWarning`                  | 直连 `wx.offMemoryWarning`                          | 直连 `my.offMemoryWarning`                                         | 无同等 API，调用时按 unsupported 报错                             |
| `cancelIdleCallback`                | 直连 `wx.cancelIdleCallback`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `onBLEConnectionStateChange`        | 直连 `wx.onBLEConnectionStateChange`                | 映射到 `my.onBLEConnectionStateChanged`                            | 抖音无同等 API，调用时报 not supported                            |
| `offBLEConnectionStateChange`       | 直连 `wx.offBLEConnectionStateChange`               | 映射到 `my.offBLEConnectionStateChanged`                           | 抖音无同等 API，调用时报 not supported                            |
| `addCard`                           | 直连 `wx.addCard`                                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `addFileToFavorites`                | 直连 `wx.addFileToFavorites`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `addPaymentPassFinish`              | 直连 `wx.addPaymentPassFinish`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `addPaymentPassGetCertificateData`  | 直连 `wx.addPaymentPassGetCertificateData`          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `addPhoneCalendar`                  | 直连 `wx.addPhoneCalendar`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `addPhoneContact`                   | 直连 `wx.addPhoneContact`                           | 直连 `my.addPhoneContact`                                          | 无同等 API，调用时按 unsupported 报错                             |
| `addPhoneRepeatCalendar`            | 直连 `wx.addPhoneRepeatCalendar`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `addVideoToFavorites`               | 直连 `wx.addVideoToFavorites`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `authorizeForMiniProgram`           | 直连 `wx.authorizeForMiniProgram`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `authPrivateMessage`                | 直连 `wx.authPrivateMessage`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `bindEmployeeRelation`              | 直连 `wx.bindEmployeeRelation`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `canAddSecureElementPass`           | 直连 `wx.canAddSecureElementPass`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `canvasGetImageData`                | 直连 `wx.canvasGetImageData`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `canvasPutImageData`                | 直连 `wx.canvasPutImageData`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkDeviceSupportHevc`            | 直连 `wx.checkDeviceSupportHevc`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkEmployeeRelation`             | 直连 `wx.checkEmployeeRelation`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkIsAddedToMyMiniProgram`       | 直连 `wx.checkIsAddedToMyMiniProgram`               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkIsOpenAccessibility`          | 直连 `wx.checkIsOpenAccessibility`                  | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkIsPictureInPictureActive`     | 直连 `wx.checkIsPictureInPictureActive`             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkIsSoterEnrolledInDevice`      | 直连 `wx.checkIsSoterEnrolledInDevice`              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `checkIsSupportSoterAuthentication` | 直连 `wx.checkIsSupportSoterAuthentication`         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openCard`                          | 直连 `wx.openCard`                                  | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openChannelsActivity`              | 直连 `wx.openChannelsActivity`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openChannelsEvent`                 | 直连 `wx.openChannelsEvent`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openChannelsLive`                  | 直连 `wx.openChannelsLive`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openChannelsLiveNoticeInfo`        | 直连 `wx.openChannelsLiveNoticeInfo`                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openChannelsUserProfile`           | 直连 `wx.openChannelsUserProfile`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openChatTool`                      | 直连 `wx.openChatTool`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openHKOfflinePayView`              | 直连 `wx.openHKOfflinePayView`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openInquiriesTopic`                | 直连 `wx.openInquiriesTopic`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openOfficialAccountArticle`        | 直连 `wx.openOfficialAccountArticle`                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openOfficialAccountChat`           | 直连 `wx.openOfficialAccountChat`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openOfficialAccountProfile`        | 直连 `wx.openOfficialAccountProfile`                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openPrivacyContract`               | 直连 `wx.openPrivacyContract`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openSystemBluetoothSetting`        | 直连 `wx.openSystemBluetoothSetting`                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `reportEvent`                       | 直连 `wx.reportEvent`                               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `reportMonitor`                     | 直连 `wx.reportMonitor`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `reportPerformance`                 | 直连 `wx.reportPerformance`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openSingleStickerView`             | 直连 `wx.openSingleStickerView`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openStickerIPView`                 | 直连 `wx.openStickerIPView`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openStickerSetView`                | 直连 `wx.openStickerSetView`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openStoreCouponDetail`             | 直连 `wx.openStoreCouponDetail`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `openStoreOrderDetail`              | 直连 `wx.openStoreOrderDetail`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `pauseBackgroundAudio`              | 直连 `wx.pauseBackgroundAudio`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `pauseVoice`                        | 直连 `wx.pauseVoice`                                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `playBackgroundAudio`               | 直连 `wx.playBackgroundAudio`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `playVoice`                         | 直连 `wx.playVoice`                                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `postMessageToReferrerMiniProgram`  | 直连 `wx.postMessageToReferrerMiniProgram`          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `postMessageToReferrerPage`         | 直连 `wx.postMessageToReferrerPage`                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `preDownloadSubpackage`             | 直连 `wx.preDownloadSubpackage`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `preloadAssets`                     | 直连 `wx.preloadAssets`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `preloadSkylineView`                | 直连 `wx.preloadSkylineView`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `preloadWebview`                    | 直连 `wx.preloadWebview`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `removeSecureElementPass`           | 直连 `wx.removeSecureElementPass`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `chooseInvoiceTitle`                | 直连 `wx.chooseInvoiceTitle`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `chooseLicensePlate`                | 直连 `wx.chooseLicensePlate`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `choosePoi`                         | 直连 `wx.choosePoi`                                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `closeBLEConnection`                | 直连 `wx.closeBLEConnection`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createBLEConnection`               | 直连 `wx.createBLEConnection`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `cropImage`                         | 直连 `wx.cropImage`                                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `editImage`                         | 直连 `wx.editImage`                                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `exitVoIPChat`                      | 直连 `wx.exitVoIPChat`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `faceDetect`                        | 直连 `wx.faceDetect`                                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getApiCategory`                    | 直连 `wx.getApiCategory`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getBackgroundFetchToken`           | 直连 `wx.getBackgroundFetchToken`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getChannelsLiveInfo`               | 直连 `wx.getChannelsLiveInfo`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getChannelsLiveNoticeInfo`         | 直连 `wx.getChannelsLiveNoticeInfo`                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getChannelsShareKey`               | 直连 `wx.getChannelsShareKey`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getChatToolInfo`                   | 直连 `wx.getChatToolInfo`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getCommonConfig`                   | 直连 `wx.getCommonConfig`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getGroupEnterInfo`                 | 直连 `wx.getGroupEnterInfo`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getPrivacySetting`                 | 直连 `wx.getPrivacySetting`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `initFaceDetect`                    | 直连 `wx.initFaceDetect`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `join1v1Chat`                       | 直连 `wx.join1v1Chat`                               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareAppMessageToGroup`            | 直连 `wx.shareAppMessageToGroup`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareEmojiToGroup`                 | 直连 `wx.shareEmojiToGroup`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareFileMessage`                  | 直连 `wx.shareFileMessage`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareFileToGroup`                  | 直连 `wx.shareFileToGroup`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareImageToGroup`                 | 直连 `wx.shareImageToGroup`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareToOfficialAccount`            | 直连 `wx.shareToOfficialAccount`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareToWeRun`                      | 直连 `wx.shareToWeRun`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareVideoMessage`                 | 直连 `wx.shareVideoMessage`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `shareVideoToGroup`                 | 直连 `wx.shareVideoToGroup`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `showRedPackage`                    | 直连 `wx.showRedPackage`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startDeviceMotionListening`        | 直连 `wx.startDeviceMotionListening`                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startHCE`                          | 直连 `wx.startHCE`                                  | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startLocalServiceDiscovery`        | 直连 `wx.startLocalServiceDiscovery`                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startLocationUpdate`               | 直连 `wx.startLocationUpdate`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startLocationUpdateBackground`     | 直连 `wx.startLocationUpdateBackground`             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startRecord`                       | 直连 `wx.startRecord`                               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `startSoterAuthentication`          | 直连 `wx.startSoterAuthentication`                  | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopBackgroundAudio`               | 直连 `wx.stopBackgroundAudio`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopDeviceMotionListening`         | 直连 `wx.stopDeviceMotionListening`                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopFaceDetect`                    | 直连 `wx.stopFaceDetect`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestCommonPayment`              | 直连 `wx.requestCommonPayment`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestDeviceVoIP`                 | 直连 `wx.requestDeviceVoIP`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestMerchantTransfer`           | 直连 `wx.requestMerchantTransfer`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requirePrivacyAuthorize`           | 直连 `wx.requirePrivacyAuthorize`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `reserveChannelsLive`               | 直连 `wx.reserveChannelsLive`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `selectGroupMembers`                | 直连 `wx.selectGroupMembers`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `sendHCEMessage`                    | 直连 `wx.sendHCEMessage`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `sendSms`                           | 直连 `wx.sendSms`                                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `setBackgroundFetchToken`           | 直连 `wx.setBackgroundFetchToken`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `setEnable1v1Chat`                  | 直连 `wx.setEnable1v1Chat`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `setTopBarText`                     | 直连 `wx.setTopBarText`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `setWindowSize`                     | 直连 `wx.setWindowSize`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopHCE`                           | 直连 `wx.stopHCE`                                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopLocalServiceDiscovery`         | 直连 `wx.stopLocalServiceDiscovery`                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopLocationUpdate`                | 直连 `wx.stopLocationUpdate`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopRecord`                        | 直连 `wx.stopRecord`                                | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `stopVoice`                         | 直连 `wx.stopVoice`                                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `subscribeVoIPVideoMembers`         | 直连 `wx.subscribeVoIPVideoMembers`                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `updateVoIPChatMuteConfig`          | 直连 `wx.updateVoIPChatMuteConfig`                  | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `updateWeChatApp`                   | 直连 `wx.updateWeChatApp`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getBackgroundAudioPlayerState`     | 直连 `wx.getBackgroundAudioPlayerState`             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getDeviceBenchmarkInfo`            | 直连 `wx.getDeviceBenchmarkInfo`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getDeviceVoIPList`                 | 直连 `wx.getDeviceVoIPList`                         | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getHCEState`                       | 直连 `wx.getHCEState`                               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getInferenceEnvInfo`               | 直连 `wx.getInferenceEnvInfo`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getNFCAdapter`                     | 直连 `wx.getNFCAdapter`                             | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getPerformance`                    | 直连 `wx.getPerformance`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getRandomValues`                   | 直连 `wx.getRandomValues`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getRealtimeLogManager`             | 直连 `wx.getRealtimeLogManager`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getRendererUserAgent`              | 直连 `wx.getRendererUserAgent`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getScreenRecordingState`           | 直连 `wx.getScreenRecordingState`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getSecureElementPasses`            | 直连 `wx.getSecureElementPasses`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getSelectedTextRange`              | 直连 `wx.getSelectedTextRange`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getShowSplashAdStatus`             | 直连 `wx.getShowSplashAdStatus`                     | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getSkylineInfo`                    | 直连 `wx.getSkylineInfo`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getUserCryptoManager`              | 直连 `wx.getUserCryptoManager`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getWeRunData`                      | 直连 `wx.getWeRunData`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `getXrFrameSystem`                  | 直连 `wx.getXrFrameSystem`                          | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `isBluetoothDevicePaired`           | 直连 `wx.isBluetoothDevicePaired`                   | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `isVKSupport`                       | 直连 `wx.isVKSupport`                               | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createBLEPeripheralServer`         | 直连 `wx.createBLEPeripheralServer`                 | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createBufferURL`                   | 直连 `wx.createBufferURL`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createCacheManager`                | 直连 `wx.createCacheManager`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createGlobalPayment`               | 直连 `wx.createGlobalPayment`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createInferenceSession`            | 直连 `wx.createInferenceSession`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createMediaAudioPlayer`            | 直连 `wx.createMediaAudioPlayer`                    | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createMediaContainer`              | 直连 `wx.createMediaContainer`                      | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createMediaRecorder`               | 直连 `wx.createMediaRecorder`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createTCPSocket`                   | 直连 `wx.createTCPSocket`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createUDPSocket`                   | 直连 `wx.createUDPSocket`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `createVideoDecoder`                | 直连 `wx.createVideoDecoder`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `loadBuiltInFontFace`               | 直连 `wx.loadBuiltInFontFace`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `notifyGroupMembers`                | 直连 `wx.notifyGroupMembers`                        | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `requestIdleCallback`               | 直连 `wx.requestIdleCallback`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `revokeBufferURL`                   | 直连 `wx.revokeBufferURL`                           | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `rewriteRoute`                      | 直连 `wx.rewriteRoute`                              | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `seekBackgroundAudio`               | 直连 `wx.seekBackgroundAudio`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `setEnableDebug`                    | 直连 `wx.setEnableDebug`                            | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |
| `setInnerAudioOption`               | 直连 `wx.setInnerAudioOption`                       | 无同等 API，调用时按 unsupported 报错                              | 无同等 API，调用时按 unsupported 报错                             |

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
