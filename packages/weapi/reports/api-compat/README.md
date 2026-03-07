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
| 支付宝可按微信命名调用的方法数   |  479 |
| 支付宝语义对齐方法数             |  235 |
| 支付宝 fallback 方法数           |  244 |
| 抖音可按微信命名调用的方法数     |  479 |
| 抖音语义对齐方法数               |  175 |
| 抖音 fallback 方法数             |  304 |
| 三端可调用完全对齐方法数         |  479 |
| 三端语义完全对齐方法数           |  173 |

## 覆盖率

| 平台                          | 可调用 API 数 | 语义对齐 API 数 | fallback API 数 | API 总数 | 可调用覆盖率 | 语义对齐覆盖率 |
| ----------------------------- | ------------: | --------------: | --------------: | -------: | -----------: | -------------: |
| 微信小程序 (`wx`)             |           479 |             479 |               0 |      479 |      100.00% |        100.00% |
| 支付宝小程序 (`my`)           |           479 |             235 |             244 |      479 |      100.00% |         49.06% |
| 抖音小程序 (`tt`)             |           479 |             175 |             304 |      479 |      100.00% |         36.53% |
| 三端可调用完全对齐 (wx/my/tt) |           479 |               - |               - |      479 |      100.00% |              - |
| 三端语义完全对齐 (wx/my/tt)   |             - |             173 |               - |      479 |            - |         36.12% |

## 核心差异映射（手工规则）

| API                               | 微信策略                                            | 支付宝策略                                                          | 抖音策略                                                              |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `showToast`                       | 直连 `wx.showToast`                                 | `title/icon` 映射到 `content/type` 后调用 `my.showToast`            | `icon=error` 映射为 `fail` 后调用 `tt.showToast`                      |
| `showLoading`                     | 直连 `wx.showLoading`                               | `title` 映射到 `content` 后调用 `my.showLoading`                    | 直连 `tt.showLoading`                                                 |
| `showActionSheet`                 | 直连 `wx.showActionSheet`                           | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐                 | 优先直连 `tt.showActionSheet`；缺失时降级到 `tt.showModal` shim       |
| `showModal`                       | 直连 `wx.showModal`                                 | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果                    | 直连 `tt.showModal`                                                   |
| `chooseImage`                     | 直连 `wx.chooseImage`                               | 返回值 `apFilePaths` 映射到 `tempFilePaths`                         | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底          |
| `chooseMedia`                     | 直连 `wx.chooseMedia`                               | 映射到 `my.chooseImage`，并补齐 `tempFiles[].tempFilePath/fileType` | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType`     |
| `chooseMessageFile`               | 直连 `wx.chooseMessageFile`                         | 映射到 `my.chooseImage`，并补齐 `tempFiles[].path/name`             | 映射到 `tt.chooseImage`，并补齐 `tempFiles[].path/name`               |
| `getFuzzyLocation`                | 直连 `wx.getFuzzyLocation`                          | 映射到 `my.getLocation`                                             | 映射到 `tt.getLocation`                                               |
| `previewMedia`                    | 直连 `wx.previewMedia`                              | 映射到 `my.previewImage`，并将 `sources.url` 对齐到 `urls`          | 映射到 `tt.previewImage`，并将 `sources.url` 对齐到 `urls`            |
| `createInterstitialAd`            | 直连 `wx.createInterstitialAd`                      | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`                 | 直连 `tt.createInterstitialAd`                                        |
| `createRewardedVideoAd`           | 直连 `wx.createRewardedVideoAd`                     | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`                 | 映射到 `tt.createInterstitialAd`                                      |
| `createLivePlayerContext`         | 直连 `wx.createLivePlayerContext`                   | 映射到 `my.createVideoContext`                                      | 直连 `tt.createLivePlayerContext`                                     |
| `createLivePusherContext`         | 直连 `wx.createLivePusherContext`                   | 映射到 `my.createVideoContext`                                      | 映射到 `tt.createVideoContext`                                        |
| `getVideoInfo`                    | 直连 `wx.getVideoInfo`                              | 直连 `my.getVideoInfo`                                              | 映射到 `tt.getFileInfo`，并将 `src` 对齐为 `filePath`                 |
| `saveFile`                        | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath`  | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath`      |
| `setClipboardData`                | 直连 `wx.setClipboardData`                          | 转调 `my.setClipboard` 并映射 `data` → `text`                       | 直连 `tt.setClipboardData`                                            |
| `getClipboardData`                | 直连 `wx.getClipboardData`                          | 转调 `my.getClipboard` 并映射 `text` → `data`                       | 直连 `tt.getClipboardData`                                            |
| `chooseAddress`                   | 直连 `wx.chooseAddress`                             | 映射到 `my.getAddress`                                              | 直连 `tt.chooseAddress`                                               |
| `createAudioContext`              | 直连 `wx.createAudioContext`                        | 映射到 `my.createInnerAudioContext`                                 | 映射到 `tt.createInnerAudioContext`                                   |
| `createWebAudioContext`           | 直连 `wx.createWebAudioContext`                     | 映射到 `my.createInnerAudioContext`                                 | 映射到 `tt.createInnerAudioContext`                                   |
| `getSystemInfoAsync`              | 直连 `wx.getSystemInfoAsync`                        | 映射到 `my.getSystemInfo`                                           | 映射到 `tt.getSystemInfo`                                             |
| `openAppAuthorizeSetting`         | 直连 `wx.openAppAuthorizeSetting`                   | 映射到 `my.openSetting`                                             | 映射到 `tt.openSetting`                                               |
| `pluginLogin`                     | 直连 `wx.pluginLogin`                               | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段                     | 映射到 `tt.login`                                                     |
| `login`                           | 直连 `wx.login`                                     | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段                     | 直连 `tt.login`                                                       |
| `authorize`                       | 直连 `wx.authorize`                                 | 映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数            | 直连 `tt.authorize`                                                   |
| `checkSession`                    | 直连 `wx.checkSession`                              | 映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok`           | 直连 `tt.checkSession`                                                |
| `requestSubscribeDeviceMessage`   | 直连 `wx.requestSubscribeDeviceMessage`             | 映射到 `my.requestSubscribeMessage`                                 | 映射到 `tt.requestSubscribeMessage`                                   |
| `requestSubscribeEmployeeMessage` | 直连 `wx.requestSubscribeEmployeeMessage`           | 映射到 `my.requestSubscribeMessage`                                 | 映射到 `tt.requestSubscribeMessage`                                   |
| `restartMiniProgram`              | 直连 `wx.restartMiniProgram`                        | 映射到 `my.reLaunch`                                                | 映射到 `tt.reLaunch`                                                  |
| `scanCode`                        | 直连 `wx.scanCode`                                  | 映射到 `my.scan`                                                    | 直连 `tt.scanCode`                                                    |
| `requestPayment`                  | 直连 `wx.requestPayment`                            | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`             | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                   |
| `requestOrderPayment`             | 直连 `wx.requestOrderPayment`                       | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`             | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                   |
| `requestPluginPayment`            | 直连 `wx.requestPluginPayment`                      | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`             | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                   |
| `requestVirtualPayment`           | 直连 `wx.requestVirtualPayment`                     | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`             | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                   |
| `showShareImageMenu`              | 直连 `wx.showShareImageMenu`                        | 映射到 `my.showSharePanel`                                          | 映射到 `tt.showShareMenu`                                             |
| `updateShareMenu`                 | 直连 `wx.updateShareMenu`                           | 映射到 `my.showSharePanel`                                          | 映射到 `tt.showShareMenu`                                             |
| `openEmbeddedMiniProgram`         | 直连 `wx.openEmbeddedMiniProgram`                   | 映射到 `my.navigateToMiniProgram`                                   | 映射到 `tt.navigateToMiniProgram`                                     |
| `saveFileToDisk`                  | 直连 `wx.saveFileToDisk`                            | 直连 `my.saveFileToDisk`                                            | 映射到 `tt.saveFile`                                                  |
| `getEnterOptionsSync`             | 直连 `wx.getEnterOptionsSync`                       | 直连 `my.getEnterOptionsSync`                                       | 映射到 `tt.getLaunchOptionsSync`                                      |
| `getSystemSetting`                | 直连 `wx.getSystemSetting`                          | 直连 `my.getSystemSetting`                                          | 映射到 `tt.getSetting`                                                |
| `getUserProfile`                  | 直连 `wx.getUserProfile`                            | 映射到 `my.getOpenUserInfo`                                         | 直连 `tt.getUserProfile`                                              |
| `getUserInfo`                     | 直连 `wx.getUserInfo`                               | 映射到 `my.getOpenUserInfo`                                         | 直连 `tt.getUserInfo`                                                 |
| `getAppAuthorizeSetting`          | 直连 `wx.getAppAuthorizeSetting`                    | 直连 `my.getAppAuthorizeSetting`                                    | 映射到 `tt.getSetting`                                                |
| `getAppBaseInfo`                  | 直连 `wx.getAppBaseInfo`                            | 直连 `my.getAppBaseInfo`                                            | 映射到 `tt.getEnvInfoSync`                                            |
| `chooseVideo`                     | 直连 `wx.chooseVideo`                               | 直连 `my.chooseVideo`                                               | 映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构      |
| `hideHomeButton`                  | 直连 `wx.hideHomeButton`                            | 映射到 `my.hideBackHome`                                            | 直连 `tt.hideHomeButton`                                              |
| `getWindowInfo`                   | 直连 `wx.getWindowInfo`                             | 直连 `my.getWindowInfo`                                             | 映射到 `tt.getSystemInfo`，并提取窗口字段                             |
| `getDeviceInfo`                   | 直连 `wx.getDeviceInfo`                             | 映射到 `my.getSystemInfo`，并提取设备字段                           | 映射到 `tt.getSystemInfo`，并提取设备字段                             |
| `getAccountInfoSync`              | 直连 `wx.getAccountInfoSync`                        | 直连 `my.getAccountInfoSync`                                        | 映射到 `tt.getEnvInfoSync`，并对齐账号字段结构                        |
| `setBackgroundColor`              | 直连 `wx.setBackgroundColor`                        | 直连 `my.setBackgroundColor`                                        | 映射到 `tt.setNavigationBarColor`，对齐 `backgroundColor/frontColor`  |
| `setBackgroundTextStyle`          | 直连 `wx.setBackgroundTextStyle`                    | 直连 `my.setBackgroundTextStyle`                                    | 映射到 `tt.setNavigationBarColor`，将 `textStyle` 对齐到 `frontColor` |
| `getNetworkType`                  | 直连 `wx.getNetworkType`                            | 直连 `my.getNetworkType`                                            | 映射到 `tt.getSystemInfo`，兜底补齐 `networkType`                     |
| `getBatteryInfo`                  | 直连 `wx.getBatteryInfo`                            | 直连 `my.getBatteryInfo`                                            | 映射到 `tt.getSystemInfo`，补齐 `level/isCharging`                    |
| `getBatteryInfoSync`              | 直连 `wx.getBatteryInfoSync`                        | 直连 `my.getBatteryInfoSync`                                        | 映射到 `tt.getSystemInfoSync`，补齐 `level/isCharging`                |
| `getLogManager`                   | 直连 `wx.getLogManager`                             | 使用内置日志 shim（对齐 `log/info/warn/error`）                     | 使用内置日志 shim（对齐 `log/info/warn/error`）                       |
| `nextTick`                        | 直连 `wx.nextTick`                                  | 使用内置 microtask shim 调度回调                                    | 使用内置 microtask shim 调度回调                                      |
| `onWindowResize`                  | 直连 `wx.onWindowResize`                            | 使用内置 shim，通过 `my.onAppShow + my.getWindowInfo` 近似监听      | 直连 `tt.onWindowResize`                                              |
| `offWindowResize`                 | 直连 `wx.offWindowResize`                           | 使用内置 shim，移除 `onWindowResize` 注册回调                       | 直连 `tt.offWindowResize`                                             |
| `reportAnalytics`                 | 直连 `wx.reportAnalytics`                           | 使用内置 no-op shim（保持调用不抛错）                               | 直连 `tt.reportAnalytics`                                             |
| `openCustomerServiceChat`         | 直连 `wx.openCustomerServiceChat`                   | 使用内置 no-op shim（保持调用不抛错）                               | 使用内置 no-op shim（保持调用不抛错）                                 |
| `createVKSession`                 | 直连 `wx.createVKSession`                           | 使用内置 VKSession shim（对齐 `start/stop/destroy`）                | 使用内置 VKSession shim（对齐 `start/stop/destroy`）                  |
| `compressVideo`                   | 直连 `wx.compressVideo`                             | 使用内置 shim（回传原始文件路径）                                   | 使用内置 shim（回传原始文件路径）                                     |
| `openVideoEditor`                 | 直连 `wx.openVideoEditor`                           | 使用内置 no-op shim（保持调用不抛错）                               | 使用内置 no-op shim（保持调用不抛错）                                 |
| `getShareInfo`                    | 直连 `wx.getShareInfo`                              | 使用内置 shim（补齐 `encryptedData/iv`）                            | 使用内置 shim（补齐 `encryptedData/iv`）                              |
| `joinVoIPChat`                    | 直连 `wx.joinVoIPChat`                              | 使用内置 no-op shim（保持调用不抛错）                               | 使用内置 no-op shim（保持调用不抛错）                                 |
| `openDocument`                    | 直连 `wx.openDocument`                              | 直连 `my.openDocument`                                              | 使用内置 no-op shim（保持调用不抛错）                                 |
| `saveVideoToPhotosAlbum`          | 直连 `wx.saveVideoToPhotosAlbum`                    | 直连 `my.saveVideoToPhotosAlbum`                                    | 映射到 `tt.saveImageToPhotosAlbum`                                    |

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
