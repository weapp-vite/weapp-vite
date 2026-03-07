# 04 抖音兼容矩阵（按微信命名）

总计：479，支持：479，不支持：0

| 微信 API                                      | 抖音目标 API                        | 支持 | 支持级别   | 语义对齐 | 策略                                                                   |
| --------------------------------------------- | ----------------------------------- | ---- | ---------- | -------- | ---------------------------------------------------------------------- |
| `addCard`                                     | `addCard`                           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addFileToFavorites`                          | `addFileToFavorites`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPaymentPassFinish`                        | `addPaymentPassFinish`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPaymentPassGetCertificateData`            | `addPaymentPassGetCertificateData`  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneCalendar`                            | `addPhoneCalendar`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneContact`                             | `addPhoneContact`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneRepeatCalendar`                      | `addPhoneRepeatCalendar`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addVideoToFavorites`                         | `addVideoToFavorites`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `arrayBufferToBase64`                         | `arrayBufferToBase64`               | ✅   | `native`   | ✅       | 直连 `tt.arrayBufferToBase64`                                          |
| `authorize`                                   | `authorize`                         | ✅   | `mapped`   | ✅       | 直连 `tt.authorize`                                                    |
| `authorizeForMiniProgram`                     | `authorizeForMiniProgram`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `authPrivateMessage`                          | `authPrivateMessage`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `base64ToArrayBuffer`                         | `base64ToArrayBuffer`               | ✅   | `native`   | ✅       | 直连 `tt.base64ToArrayBuffer`                                          |
| `batchGetStorage`                             | `batchGetStorage`                   | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `tt.getStorage`                                |
| `batchGetStorageSync`                         | `batchGetStorageSync`               | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `tt.getStorageSync`                            |
| `batchSetStorage`                             | `batchSetStorage`                   | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `tt.setStorage`                                |
| `batchSetStorageSync`                         | `batchSetStorageSync`               | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `tt.setStorageSync`                            |
| `bindEmployeeRelation`                        | `bindEmployeeRelation`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canAddSecureElementPass`                     | `canAddSecureElementPass`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `cancelIdleCallback`                          | `cancelIdleCallback`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canIUse`                                     | `canIUse`                           | ✅   | `native`   | ✅       | 直连 `tt.canIUse`                                                      |
| `canvasGetImageData`                          | `canvasGetImageData`                | ✅   | `mapped`   | ✅       | 使用内置 shim，返回空像素数据结构                                      |
| `canvasPutImageData`                          | `canvasPutImageData`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canvasToTempFilePath`                        | `canvasToTempFilePath`              | ✅   | `native`   | ✅       | 直连 `tt.canvasToTempFilePath`                                         |
| `checkDeviceSupportHevc`                      | `checkDeviceSupportHevc`            | ✅   | `mapped`   | ✅       | 使用内置 shim，返回默认不支持                                          |
| `checkEmployeeRelation`                       | `checkEmployeeRelation`             | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未绑定                                              |
| `checkIsAddedToMyMiniProgram`                 | `checkIsAddedToMyMiniProgram`       | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未添加                                              |
| `checkIsOpenAccessibility`                    | `checkIsOpenAccessibility`          | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未开启                                              |
| `checkIsPictureInPictureActive`               | `checkIsPictureInPictureActive`     | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未激活                                              |
| `checkIsSoterEnrolledInDevice`                | `checkIsSoterEnrolledInDevice`      | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未录入                                              |
| `checkIsSupportSoterAuthentication`           | `checkIsSupportSoterAuthentication` | ✅   | `mapped`   | ✅       | 使用内置 shim，返回默认不支持                                          |
| `checkSession`                                | `checkSession`                      | ✅   | `mapped`   | ✅       | 直连 `tt.checkSession`                                                 |
| `chooseAddress`                               | `chooseAddress`                     | ✅   | `mapped`   | ✅       | 直连 `tt.chooseAddress`                                                |
| `chooseContact`                               | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `chooseImage`                                 | `chooseImage`                       | ✅   | `mapped`   | ✅       | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底           |
| `chooseInvoice`                               | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `chooseInvoiceTitle`                          | `chooseInvoiceTitle`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseLicensePlate`                          | `chooseLicensePlate`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseLocation`                              | `chooseLocation`                    | ✅   | `native`   | ✅       | 直连 `tt.chooseLocation`                                               |
| `chooseMedia`                                 | `chooseMedia`                       | ✅   | `mapped`   | ✅       | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType`      |
| `chooseMessageFile`                           | `chooseImage`                       | ✅   | `mapped`   | ✅       | 映射到 `tt.chooseImage`，并补齐 `tempFiles[].path/name`                |
| `choosePoi`                                   | `choosePoi`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseVideo`                                 | `chooseMedia`                       | ✅   | `mapped`   | ✅       | 映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构       |
| `clearStorage`                                | `clearStorage`                      | ✅   | `native`   | ✅       | 直连 `tt.clearStorage`                                                 |
| `clearStorageSync`                            | `clearStorageSync`                  | ✅   | `native`   | ✅       | 直连 `tt.clearStorageSync`                                             |
| `closeBLEConnection`                          | `closeBLEConnection`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `closeBluetoothAdapter`                       | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `closeSocket`                                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `compressImage`                               | `compressImage`                     | ✅   | `native`   | ✅       | 直连 `tt.compressImage`                                                |
| `compressVideo`                               | `compressVideo`                     | ✅   | `mapped`   | ✅       | 使用内置 shim（回传原始文件路径）                                      |
| `connectSocket`                               | `connectSocket`                     | ✅   | `native`   | ✅       | 直连 `tt.connectSocket`                                                |
| `connectWifi`                                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createAnimation`                             | `createAnimation`                   | ✅   | `native`   | ✅       | 直连 `tt.createAnimation`                                              |
| `createAudioContext`                          | `createInnerAudioContext`           | ✅   | `mapped`   | ✅       | 映射到 `tt.createInnerAudioContext`                                    |
| `createBLEConnection`                         | `createBLEConnection`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createBLEPeripheralServer`                   | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createBufferURL`                             | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createCacheManager`                          | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createCameraContext`                         | `createCameraContext`               | ✅   | `mapped`   | ✅       | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） |
| `createCanvasContext`                         | `createCanvasContext`               | ✅   | `native`   | ✅       | 直连 `tt.createCanvasContext`                                          |
| `createGlobalPayment`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createInferenceSession`                      | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createInnerAudioContext`                     | `createInnerAudioContext`           | ✅   | `native`   | ✅       | 直连 `tt.createInnerAudioContext`                                      |
| `createIntersectionObserver`                  | `createIntersectionObserver`        | ✅   | `native`   | ✅       | 直连 `tt.createIntersectionObserver`                                   |
| `createInterstitialAd`                        | `createInterstitialAd`              | ✅   | `mapped`   | ✅       | 直连 `tt.createInterstitialAd`                                         |
| `createLivePlayerContext`                     | `createLivePlayerContext`           | ✅   | `mapped`   | ✅       | 直连 `tt.createLivePlayerContext`                                      |
| `createLivePusherContext`                     | `createVideoContext`                | ✅   | `mapped`   | ✅       | 映射到 `tt.createVideoContext`                                         |
| `createMapContext`                            | `createMapContext`                  | ✅   | `native`   | ✅       | 直连 `tt.createMapContext`                                             |
| `createMediaAudioPlayer`                      | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createMediaContainer`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createMediaRecorder`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createOffscreenCanvas`                       | `createOffscreenCanvas`             | ✅   | `native`   | ✅       | 直连 `tt.createOffscreenCanvas`                                        |
| `createRewardedVideoAd`                       | `createInterstitialAd`              | ✅   | `mapped`   | ✅       | 映射到 `tt.createInterstitialAd`                                       |
| `createSelectorQuery`                         | `createSelectorQuery`               | ✅   | `native`   | ✅       | 直连 `tt.createSelectorQuery`                                          |
| `createTCPSocket`                             | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createUDPSocket`                             | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createVideoContext`                          | `createVideoContext`                | ✅   | `native`   | ✅       | 直连 `tt.createVideoContext`                                           |
| `createVideoDecoder`                          | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `createVKSession`                             | `createVKSession`                   | ✅   | `mapped`   | ✅       | 使用内置 VKSession shim（对齐 `start/stop/destroy`）                   |
| `createWebAudioContext`                       | `createInnerAudioContext`           | ✅   | `mapped`   | ✅       | 映射到 `tt.createInnerAudioContext`                                    |
| `createWorker`                                | `createWorker`                      | ✅   | `native`   | ✅       | 直连 `tt.createWorker`                                                 |
| `cropImage`                                   | `cropImage`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `disableAlertBeforeUnload`                    | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `downloadFile`                                | `downloadFile`                      | ✅   | `native`   | ✅       | 直连 `tt.downloadFile`                                                 |
| `editImage`                                   | `editImage`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `enableAlertBeforeUnload`                     | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `exitMiniProgram`                             | `exitMiniProgram`                   | ✅   | `native`   | ✅       | 直连 `tt.exitMiniProgram`                                              |
| `exitVoIPChat`                                | `exitVoIPChat`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `faceDetect`                                  | `faceDetect`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getAccountInfoSync`                          | `getEnvInfoSync`                    | ✅   | `mapped`   | ✅       | 映射到 `tt.getEnvInfoSync`，并对齐账号字段结构                         |
| `getApiCategory`                              | `getApiCategory`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getAppAuthorizeSetting`                      | `getSetting`                        | ✅   | `mapped`   | ✅       | 映射到 `tt.getSetting`                                                 |
| `getAppBaseInfo`                              | `getEnvInfoSync`                    | ✅   | `mapped`   | ✅       | 映射到 `tt.getEnvInfoSync`                                             |
| `getAvailableAudioSources`                    | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBackgroundAudioManager`                   | `getBackgroundAudioManager`         | ✅   | `native`   | ✅       | 直连 `tt.getBackgroundAudioManager`                                    |
| `getBackgroundAudioPlayerState`               | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBackgroundFetchData`                      | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBackgroundFetchToken`                     | `getBackgroundFetchToken`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getBatteryInfo`                              | `getSystemInfo`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.getSystemInfo`，补齐 `level/isCharging`                     |
| `getBatteryInfoSync`                          | `getSystemInfoSync`                 | ✅   | `mapped`   | ✅       | 映射到 `tt.getSystemInfoSync`，补齐 `level/isCharging`                 |
| `getBeacons`                                  | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBLEDeviceCharacteristics`                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBLEDeviceRSSI`                            | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBLEDeviceServices`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBLEMTU`                                   | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBluetoothAdapterState`                    | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getBluetoothDevices`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getChannelsLiveInfo`                         | `getChannelsLiveInfo`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsLiveNoticeInfo`                   | `getChannelsLiveNoticeInfo`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsShareKey`                         | `getChannelsShareKey`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChatToolInfo`                             | `getChatToolInfo`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getClipboardData`                            | `getClipboardData`                  | ✅   | `mapped`   | ✅       | 直连 `tt.getClipboardData`                                             |
| `getCommonConfig`                             | `getCommonConfig`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getConnectedBluetoothDevices`                | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getConnectedWifi`                            | `getConnectedWifi`                  | ✅   | `native`   | ✅       | 直连 `tt.getConnectedWifi`                                             |
| `getDeviceBenchmarkInfo`                      | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getDeviceInfo`                               | `getSystemInfo`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.getSystemInfo`，并提取设备字段                              |
| `getDeviceVoIPList`                           | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getEnterOptionsSync`                         | `getLaunchOptionsSync`              | ✅   | `mapped`   | ✅       | 映射到 `tt.getLaunchOptionsSync`                                       |
| `getExptInfoSync`                             | `getSystemInfoSync`                 | ✅   | `fallback` | ❌       | 回退映射到 `tt.getSystemInfoSync`（通用兜底）                          |
| `getExtConfig`                                | `getExtConfig`                      | ✅   | `native`   | ✅       | 直连 `tt.getExtConfig`                                                 |
| `getExtConfigSync`                            | `getExtConfigSync`                  | ✅   | `native`   | ✅       | 直连 `tt.getExtConfigSync`                                             |
| `getFileSystemManager`                        | `getFileSystemManager`              | ✅   | `native`   | ✅       | 直连 `tt.getFileSystemManager`                                         |
| `getFuzzyLocation`                            | `getLocation`                       | ✅   | `mapped`   | ✅       | 映射到 `tt.getLocation`                                                |
| `getGroupEnterInfo`                           | `getGroupEnterInfo`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getHCEState`                                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getImageInfo`                                | `getImageInfo`                      | ✅   | `native`   | ✅       | 直连 `tt.getImageInfo`                                                 |
| `getInferenceEnvInfo`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getLaunchOptionsSync`                        | `getLaunchOptionsSync`              | ✅   | `native`   | ✅       | 直连 `tt.getLaunchOptionsSync`                                         |
| `getLocalIPAddress`                           | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getLocation`                                 | `getLocation`                       | ✅   | `native`   | ✅       | 直连 `tt.getLocation`                                                  |
| `getLogManager`                               | `getLogManager`                     | ✅   | `mapped`   | ✅       | 使用内置日志 shim（对齐 `log/info/warn/error`）                        |
| `getMenuButtonBoundingClientRect`             | `getMenuButtonBoundingClientRect`   | ✅   | `native`   | ✅       | 直连 `tt.getMenuButtonBoundingClientRect`                              |
| `getNetworkType`                              | `getSystemInfo`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.getSystemInfo`，兜底补齐 `networkType`                      |
| `getNFCAdapter`                               | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getPerformance`                              | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getPrivacySetting`                           | `getPrivacySetting`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRandomValues`                             | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getRealtimeLogManager`                       | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getRecorderManager`                          | `getRecorderManager`                | ✅   | `native`   | ✅       | 直连 `tt.getRecorderManager`                                           |
| `getRendererUserAgent`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getScreenBrightness`                         | `getScreenBrightness`               | ✅   | `native`   | ✅       | 直连 `tt.getScreenBrightness`                                          |
| `getScreenRecordingState`                     | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getSecureElementPasses`                      | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getSelectedTextRange`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getSetting`                                  | `getSetting`                        | ✅   | `native`   | ✅       | 直连 `tt.getSetting`                                                   |
| `getShareInfo`                                | `getShareInfo`                      | ✅   | `mapped`   | ✅       | 使用内置 shim（补齐 `encryptedData/iv`）                               |
| `getShowSplashAdStatus`                       | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getSkylineInfo`                              | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getSkylineInfoSync`                          | `getSystemInfoSync`                 | ✅   | `fallback` | ❌       | 回退映射到 `tt.getSystemInfoSync`（通用兜底）                          |
| `getStorage`                                  | `getStorage`                        | ✅   | `native`   | ✅       | 直连 `tt.getStorage`                                                   |
| `getStorageInfo`                              | `getStorageInfo`                    | ✅   | `native`   | ✅       | 直连 `tt.getStorageInfo`                                               |
| `getStorageInfoSync`                          | `getStorageInfoSync`                | ✅   | `native`   | ✅       | 直连 `tt.getStorageInfoSync`                                           |
| `getStorageSync`                              | `getStorageSync`                    | ✅   | `native`   | ✅       | 直连 `tt.getStorageSync`                                               |
| `getSystemInfo`                               | `getSystemInfo`                     | ✅   | `native`   | ✅       | 直连 `tt.getSystemInfo`                                                |
| `getSystemInfoAsync`                          | `getSystemInfo`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.getSystemInfo`                                              |
| `getSystemInfoSync`                           | `getSystemInfoSync`                 | ✅   | `native`   | ✅       | 直连 `tt.getSystemInfoSync`                                            |
| `getSystemSetting`                            | `getSetting`                        | ✅   | `mapped`   | ✅       | 映射到 `tt.getSetting`                                                 |
| `getUpdateManager`                            | `getUpdateManager`                  | ✅   | `native`   | ✅       | 直连 `tt.getUpdateManager`                                             |
| `getUserCryptoManager`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getUserInfo`                                 | `getUserInfo`                       | ✅   | `mapped`   | ✅       | 直连 `tt.getUserInfo`                                                  |
| `getUserProfile`                              | `getUserProfile`                    | ✅   | `mapped`   | ✅       | 直连 `tt.getUserProfile`                                               |
| `getVideoInfo`                                | `getFileInfo`                       | ✅   | `mapped`   | ✅       | 映射到 `tt.getFileInfo`，并将 `src` 对齐为 `filePath`                  |
| `getWeRunData`                                | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `getWifiList`                                 | `getWifiList`                       | ✅   | `native`   | ✅       | 直连 `tt.getWifiList`                                                  |
| `getWindowInfo`                               | `getSystemInfo`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.getSystemInfo`，并提取窗口字段                              |
| `getXrFrameSystem`                            | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `hideHomeButton`                              | `hideHomeButton`                    | ✅   | `mapped`   | ✅       | 直连 `tt.hideHomeButton`                                               |
| `hideKeyboard`                                | `hideKeyboard`                      | ✅   | `native`   | ✅       | 直连 `tt.hideKeyboard`                                                 |
| `hideLoading`                                 | `hideLoading`                       | ✅   | `native`   | ✅       | 直连 `tt.hideLoading`                                                  |
| `hideNavigationBarLoading`                    | `hideNavigationBarLoading`          | ✅   | `native`   | ✅       | 直连 `tt.hideNavigationBarLoading`                                     |
| `hideShareMenu`                               | `hideShareMenu`                     | ✅   | `native`   | ✅       | 直连 `tt.hideShareMenu`                                                |
| `hideTabBar`                                  | `hideTabBar`                        | ✅   | `native`   | ✅       | 直连 `tt.hideTabBar`                                                   |
| `hideTabBarRedDot`                            | `hideTabBarRedDot`                  | ✅   | `native`   | ✅       | 直连 `tt.hideTabBarRedDot`                                             |
| `hideToast`                                   | `hideToast`                         | ✅   | `native`   | ✅       | 直连 `tt.hideToast`                                                    |
| `initFaceDetect`                              | `initFaceDetect`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `isBluetoothDevicePaired`                     | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `isVKSupport`                                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `join1v1Chat`                                 | `join1v1Chat`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `joinVoIPChat`                                | `joinVoIPChat`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `loadBuiltInFontFace`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `loadFontFace`                                | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `login`                                       | `login`                             | ✅   | `mapped`   | ✅       | 直连 `tt.login`                                                        |
| `makeBluetoothPair`                           | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `makePhoneCall`                               | `makePhoneCall`                     | ✅   | `native`   | ✅       | 直连 `tt.makePhoneCall`                                                |
| `navigateBack`                                | `navigateBack`                      | ✅   | `native`   | ✅       | 直连 `tt.navigateBack`                                                 |
| `navigateBackMiniProgram`                     | `navigateBackMiniProgram`           | ✅   | `native`   | ✅       | 直连 `tt.navigateBackMiniProgram`                                      |
| `navigateTo`                                  | `navigateTo`                        | ✅   | `native`   | ✅       | 直连 `tt.navigateTo`                                                   |
| `navigateToMiniProgram`                       | `navigateToMiniProgram`             | ✅   | `native`   | ✅       | 直连 `tt.navigateToMiniProgram`                                        |
| `nextTick`                                    | `nextTick`                          | ✅   | `mapped`   | ✅       | 使用内置 microtask shim 调度回调                                       |
| `notifyBLECharacteristicValueChange`          | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `notifyGroupMembers`                          | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `offAccelerometerChange`                      | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offAfterPageLoad`                            | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offAfterPageUnload`                          | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offApiCategoryChange`                        | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offAppHide`                                  | `offAppHide`                        | ✅   | `native`   | ✅       | 直连 `tt.offAppHide`                                                   |
| `offAppRoute`                                 | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offAppRouteDone`                             | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offAppShow`                                  | `offAppShow`                        | ✅   | `native`   | ✅       | 直连 `tt.offAppShow`                                                   |
| `offAudioInterruptionBegin`                   | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offAudioInterruptionEnd`                     | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBatteryInfoChange`                        | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBeaconServiceChange`                      | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBeaconUpdate`                             | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBeforeAppRoute`                           | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBeforePageLoad`                           | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBeforePageUnload`                         | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBLECharacteristicValueChange`             | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBLEConnectionStateChange`                 | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBLEMTUChange`                             | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBLEPeripheralConnectionStateChanged`      | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBluetoothAdapterStateChange`              | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offBluetoothDeviceFound`                     | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offCompassChange`                            | `offCompassChange`                  | ✅   | `native`   | ✅       | 直连 `tt.offCompassChange`                                             |
| `offCopyUrl`                                  | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offDeviceMotionChange`                       | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offEmbeddedMiniProgramHeightChange`          | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offError`                                    | `offError`                          | ✅   | `native`   | ✅       | 直连 `tt.offError`                                                     |
| `offGeneratePoster`                           | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offGetWifiList`                              | `offGetWifiList`                    | ✅   | `native`   | ✅       | 直连 `tt.offGetWifiList`                                               |
| `offGyroscopeChange`                          | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offHCEMessage`                               | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offKeyboardHeightChange`                     | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offKeyDown`                                  | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offKeyUp`                                    | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offLazyLoadError`                            | `offLazyLoadError`                  | ✅   | `native`   | ✅       | 直连 `tt.offLazyLoadError`                                             |
| `offLocalServiceDiscoveryStop`                | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offLocalServiceFound`                        | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offLocalServiceLost`                         | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offLocalServiceResolveFail`                  | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offLocationChange`                           | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offLocationChangeError`                      | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offMemoryWarning`                            | `offMemoryWarning`                  | ✅   | `mapped`   | ✅       | 使用内置 shim，配合 `tt.onMemoryWarning` 实现监听解绑                  |
| `offMenuButtonBoundingClientRectWeightChange` | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offNetworkStatusChange`                      | `offNetworkStatusChange`            | ✅   | `native`   | ✅       | 直连 `tt.offNetworkStatusChange`                                       |
| `offNetworkWeakChange`                        | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offOnUserTriggerTranslation`                 | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offPageNotFound`                             | `offPageNotFound`                   | ✅   | `native`   | ✅       | 直连 `tt.offPageNotFound`                                              |
| `offParallelStateChange`                      | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offScreenRecordingStateChanged`              | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offThemeChange`                              | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offUnhandledRejection`                       | `offUnhandledRejection`             | ✅   | `native`   | ✅       | 直连 `tt.offUnhandledRejection`                                        |
| `offUserCaptureScreen`                        | `offUserCaptureScreen`              | ✅   | `native`   | ✅       | 直连 `tt.offUserCaptureScreen`                                         |
| `offVoIPChatInterrupted`                      | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offVoIPChatMembersChanged`                   | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offVoIPChatSpeakersChanged`                  | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offVoIPChatStateChanged`                     | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offVoIPVideoMembersChanged`                  | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offWifiConnected`                            | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offWifiConnectedWithPartialInfo`             | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `offWindowResize`                             | `offWindowResize`                   | ✅   | `mapped`   | ✅       | 直连 `tt.offWindowResize`                                              |
| `offWindowStateChange`                        | `offAppShow`                        | ✅   | `fallback` | ❌       | 回退映射到 `tt.offAppShow`（通用兜底）                                 |
| `onAccelerometerChange`                       | `onAccelerometerChange`             | ✅   | `native`   | ✅       | 直连 `tt.onAccelerometerChange`                                        |
| `onAfterPageLoad`                             | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onAfterPageUnload`                           | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onApiCategoryChange`                         | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onAppHide`                                   | `onAppHide`                         | ✅   | `native`   | ✅       | 直连 `tt.onAppHide`                                                    |
| `onAppRoute`                                  | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onAppRouteDone`                              | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onAppShow`                                   | `onAppShow`                         | ✅   | `native`   | ✅       | 直连 `tt.onAppShow`                                                    |
| `onAudioInterruptionBegin`                    | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onAudioInterruptionEnd`                      | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBackgroundAudioPause`                      | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBackgroundAudioPlay`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBackgroundAudioStop`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBackgroundFetchData`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBatteryInfoChange`                         | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBeaconServiceChange`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBeaconUpdate`                              | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBeforeAppRoute`                            | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBeforePageLoad`                            | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBeforePageUnload`                          | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBLECharacteristicValueChange`              | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBLEConnectionStateChange`                  | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBLEMTUChange`                              | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBLEPeripheralConnectionStateChanged`       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBluetoothAdapterStateChange`               | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onBluetoothDeviceFound`                      | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onCompassChange`                             | `onCompassChange`                   | ✅   | `native`   | ✅       | 直连 `tt.onCompassChange`                                              |
| `onCopyUrl`                                   | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onDeviceMotionChange`                        | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onEmbeddedMiniProgramHeightChange`           | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onError`                                     | `onError`                           | ✅   | `native`   | ✅       | 直连 `tt.onError`                                                      |
| `onGeneratePoster`                            | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onGetWifiList`                               | `onGetWifiList`                     | ✅   | `native`   | ✅       | 直连 `tt.onGetWifiList`                                                |
| `onGyroscopeChange`                           | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onHCEMessage`                                | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onKeyboardHeightChange`                      | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onKeyDown`                                   | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onKeyUp`                                     | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onLazyLoadError`                             | `onLazyLoadError`                   | ✅   | `native`   | ✅       | 直连 `tt.onLazyLoadError`                                              |
| `onLocalServiceDiscoveryStop`                 | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onLocalServiceFound`                         | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onLocalServiceLost`                          | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onLocalServiceResolveFail`                   | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onLocationChange`                            | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onLocationChangeError`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onMemoryWarning`                             | `onMemoryWarning`                   | ✅   | `native`   | ✅       | 直连 `tt.onMemoryWarning`                                              |
| `onMenuButtonBoundingClientRectWeightChange`  | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onNeedPrivacyAuthorization`                  | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onNetworkStatusChange`                       | `onNetworkStatusChange`             | ✅   | `native`   | ✅       | 直连 `tt.onNetworkStatusChange`                                        |
| `onNetworkWeakChange`                         | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onOnUserTriggerTranslation`                  | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onPageNotFound`                              | `onPageNotFound`                    | ✅   | `native`   | ✅       | 直连 `tt.onPageNotFound`                                               |
| `onParallelStateChange`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onScreenRecordingStateChanged`               | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onSocketClose`                               | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onSocketError`                               | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onSocketMessage`                             | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onSocketOpen`                                | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onThemeChange`                               | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onUnhandledRejection`                        | `onUnhandledRejection`              | ✅   | `native`   | ✅       | 直连 `tt.onUnhandledRejection`                                         |
| `onUserCaptureScreen`                         | `onUserCaptureScreen`               | ✅   | `native`   | ✅       | 直连 `tt.onUserCaptureScreen`                                          |
| `onVoIPChatInterrupted`                       | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onVoIPChatMembersChanged`                    | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onVoIPChatSpeakersChanged`                   | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onVoIPChatStateChanged`                      | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onVoIPVideoMembersChanged`                   | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onWifiConnected`                             | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onWifiConnectedWithPartialInfo`              | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `onWindowResize`                              | `onWindowResize`                    | ✅   | `mapped`   | ✅       | 直连 `tt.onWindowResize`                                               |
| `onWindowStateChange`                         | `onAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.onAppShow`（通用兜底）                                  |
| `openAppAuthorizeSetting`                     | `openSetting`                       | ✅   | `mapped`   | ✅       | 映射到 `tt.openSetting`                                                |
| `openBluetoothAdapter`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `openCard`                                    | `openCard`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsActivity`                        | `openChannelsActivity`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsEvent`                           | `openChannelsEvent`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsLive`                            | `openChannelsLive`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsLiveNoticeInfo`                  | `openChannelsLiveNoticeInfo`        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsUserProfile`                     | `openChannelsUserProfile`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChatTool`                                | `openChatTool`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openCustomerServiceChat`                     | `openCustomerServiceChat`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openDocument`                                | `openDocument`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openEmbeddedMiniProgram`                     | `navigateToMiniProgram`             | ✅   | `mapped`   | ✅       | 映射到 `tt.navigateToMiniProgram`                                      |
| `openHKOfflinePayView`                        | `openHKOfflinePayView`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openInquiriesTopic`                          | `openInquiriesTopic`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openLocation`                                | `openLocation`                      | ✅   | `native`   | ✅       | 直连 `tt.openLocation`                                                 |
| `openOfficialAccountArticle`                  | `openOfficialAccountArticle`        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountChat`                     | `openOfficialAccountChat`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountProfile`                  | `openOfficialAccountProfile`        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openPrivacyContract`                         | `openPrivacyContract`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openSetting`                                 | `openSetting`                       | ✅   | `native`   | ✅       | 直连 `tt.openSetting`                                                  |
| `openSingleStickerView`                       | `openSingleStickerView`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStickerIPView`                           | `openStickerIPView`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStickerSetView`                          | `openStickerSetView`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStoreCouponDetail`                       | `openStoreCouponDetail`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStoreOrderDetail`                        | `openStoreOrderDetail`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openSystemBluetoothSetting`                  | `openSystemBluetoothSetting`        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openVideoEditor`                             | `openVideoEditor`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pageScrollTo`                                | `pageScrollTo`                      | ✅   | `native`   | ✅       | 直连 `tt.pageScrollTo`                                                 |
| `pauseBackgroundAudio`                        | `pauseBackgroundAudio`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pauseVoice`                                  | `pauseVoice`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `playBackgroundAudio`                         | `playBackgroundAudio`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `playVoice`                                   | `playVoice`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pluginLogin`                                 | `login`                             | ✅   | `mapped`   | ✅       | 映射到 `tt.login`                                                      |
| `postMessageToReferrerMiniProgram`            | `postMessageToReferrerMiniProgram`  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `postMessageToReferrerPage`                   | `postMessageToReferrerPage`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preDownloadSubpackage`                       | `preDownloadSubpackage`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadAssets`                               | `preloadAssets`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadSkylineView`                          | `preloadSkylineView`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadWebview`                              | `preloadWebview`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `previewImage`                                | `previewImage`                      | ✅   | `native`   | ✅       | 直连 `tt.previewImage`                                                 |
| `previewMedia`                                | `previewImage`                      | ✅   | `mapped`   | ✅       | 映射到 `tt.previewImage`，并将 `sources.url` 对齐到 `urls`             |
| `readBLECharacteristicValue`                  | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `redirectTo`                                  | `redirectTo`                        | ✅   | `native`   | ✅       | 直连 `tt.redirectTo`                                                   |
| `reLaunch`                                    | `reLaunch`                          | ✅   | `native`   | ✅       | 直连 `tt.reLaunch`                                                     |
| `removeSecureElementPass`                     | `removeSecureElementPass`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `removeStorage`                               | `removeStorage`                     | ✅   | `native`   | ✅       | 直连 `tt.removeStorage`                                                |
| `removeStorageSync`                           | `removeStorageSync`                 | ✅   | `native`   | ✅       | 直连 `tt.removeStorageSync`                                            |
| `removeTabBarBadge`                           | `removeTabBarBadge`                 | ✅   | `native`   | ✅       | 直连 `tt.removeTabBarBadge`                                            |
| `reportAnalytics`                             | `reportAnalytics`                   | ✅   | `mapped`   | ✅       | 直连 `tt.reportAnalytics`                                              |
| `reportEvent`                                 | `reportEvent`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportMonitor`                               | `reportMonitor`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportPerformance`                           | `reportPerformance`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `request`                                     | `request`                           | ✅   | `native`   | ✅       | 直连 `tt.request`                                                      |
| `requestCommonPayment`                        | `requestCommonPayment`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestDeviceVoIP`                           | `requestDeviceVoIP`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestIdleCallback`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `requestMerchantTransfer`                     | `requestMerchantTransfer`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestOrderPayment`                         | `pay`                               | ✅   | `mapped`   | ✅       | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requestPayment`                              | `pay`                               | ✅   | `mapped`   | ✅       | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requestPluginPayment`                        | `pay`                               | ✅   | `mapped`   | ✅       | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requestSubscribeDeviceMessage`               | `requestSubscribeMessage`           | ✅   | `mapped`   | ✅       | 映射到 `tt.requestSubscribeMessage`                                    |
| `requestSubscribeEmployeeMessage`             | `requestSubscribeMessage`           | ✅   | `mapped`   | ✅       | 映射到 `tt.requestSubscribeMessage`                                    |
| `requestSubscribeMessage`                     | `requestSubscribeMessage`           | ✅   | `native`   | ✅       | 直连 `tt.requestSubscribeMessage`                                      |
| `requestVirtualPayment`                       | `pay`                               | ✅   | `mapped`   | ✅       | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`                    |
| `requirePrivacyAuthorize`                     | `requirePrivacyAuthorize`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reserveChannelsLive`                         | `reserveChannelsLive`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `restartMiniProgram`                          | `reLaunch`                          | ✅   | `mapped`   | ✅       | 映射到 `tt.reLaunch`                                                   |
| `revokeBufferURL`                             | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `rewriteRoute`                                | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `saveFileToDisk`                              | `saveFile`                          | ✅   | `mapped`   | ✅       | 映射到 `tt.saveFile`                                                   |
| `saveImageToPhotosAlbum`                      | `saveImageToPhotosAlbum`            | ✅   | `native`   | ✅       | 直连 `tt.saveImageToPhotosAlbum`                                       |
| `saveVideoToPhotosAlbum`                      | `saveImageToPhotosAlbum`            | ✅   | `mapped`   | ✅       | 映射到 `tt.saveImageToPhotosAlbum`                                     |
| `scanCode`                                    | `scanCode`                          | ✅   | `mapped`   | ✅       | 直连 `tt.scanCode`                                                     |
| `seekBackgroundAudio`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `selectGroupMembers`                          | `selectGroupMembers`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendHCEMessage`                              | `sendHCEMessage`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendSms`                                     | `sendSms`                           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendSocketMessage`                           | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `setBackgroundColor`                          | `setNavigationBarColor`             | ✅   | `mapped`   | ✅       | 映射到 `tt.setNavigationBarColor`，对齐 `backgroundColor/frontColor`   |
| `setBackgroundFetchToken`                     | `setBackgroundFetchToken`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setBackgroundTextStyle`                      | `setNavigationBarColor`             | ✅   | `mapped`   | ✅       | 映射到 `tt.setNavigationBarColor`，将 `textStyle` 对齐到 `frontColor`  |
| `setBLEMTU`                                   | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `setClipboardData`                            | `setClipboardData`                  | ✅   | `mapped`   | ✅       | 直连 `tt.setClipboardData`                                             |
| `setEnable1v1Chat`                            | `setEnable1v1Chat`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setEnableDebug`                              | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `setInnerAudioOption`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `setKeepScreenOn`                             | `setKeepScreenOn`                   | ✅   | `native`   | ✅       | 直连 `tt.setKeepScreenOn`                                              |
| `setNavigationBarColor`                       | `setNavigationBarColor`             | ✅   | `native`   | ✅       | 直连 `tt.setNavigationBarColor`                                        |
| `setNavigationBarTitle`                       | `setNavigationBarTitle`             | ✅   | `native`   | ✅       | 直连 `tt.setNavigationBarTitle`                                        |
| `setScreenBrightness`                         | `setScreenBrightness`               | ✅   | `native`   | ✅       | 直连 `tt.setScreenBrightness`                                          |
| `setStorage`                                  | `setStorage`                        | ✅   | `native`   | ✅       | 直连 `tt.setStorage`                                                   |
| `setStorageSync`                              | `setStorageSync`                    | ✅   | `native`   | ✅       | 直连 `tt.setStorageSync`                                               |
| `setTabBarBadge`                              | `setTabBarBadge`                    | ✅   | `native`   | ✅       | 直连 `tt.setTabBarBadge`                                               |
| `setTabBarItem`                               | `setTabBarItem`                     | ✅   | `native`   | ✅       | 直连 `tt.setTabBarItem`                                                |
| `setTabBarStyle`                              | `setTabBarStyle`                    | ✅   | `native`   | ✅       | 直连 `tt.setTabBarStyle`                                               |
| `setTopBarText`                               | `setTopBarText`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setVisualEffectOnCapture`                    | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `setWifiList`                                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `setWindowSize`                               | `setWindowSize`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareAppMessageToGroup`                      | `shareAppMessageToGroup`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareEmojiToGroup`                           | `shareEmojiToGroup`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareFileMessage`                            | `shareFileMessage`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareFileToGroup`                            | `shareFileToGroup`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareImageToGroup`                           | `shareImageToGroup`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareToOfficialAccount`                      | `shareToOfficialAccount`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareToWeRun`                                | `shareToWeRun`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareVideoMessage`                           | `shareVideoMessage`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareVideoToGroup`                           | `shareVideoToGroup`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `showActionSheet`                             | `showActionSheet`                   | ✅   | `mapped`   | ✅       | 优先直连 `tt.showActionSheet`；缺失时降级到 `tt.showModal` shim        |
| `showLoading`                                 | `showLoading`                       | ✅   | `mapped`   | ✅       | 直连 `tt.showLoading`                                                  |
| `showModal`                                   | `showModal`                         | ✅   | `mapped`   | ✅       | 直连 `tt.showModal`                                                    |
| `showNavigationBarLoading`                    | `showNavigationBarLoading`          | ✅   | `native`   | ✅       | 直连 `tt.showNavigationBarLoading`                                     |
| `showRedPackage`                              | `showRedPackage`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `showShareImageMenu`                          | `showShareMenu`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.showShareMenu`                                              |
| `showShareMenu`                               | `showShareMenu`                     | ✅   | `native`   | ✅       | 直连 `tt.showShareMenu`                                                |
| `showTabBar`                                  | `showTabBar`                        | ✅   | `native`   | ✅       | 直连 `tt.showTabBar`                                                   |
| `showTabBarRedDot`                            | `showTabBarRedDot`                  | ✅   | `native`   | ✅       | 直连 `tt.showTabBarRedDot`                                             |
| `showToast`                                   | `showToast`                         | ✅   | `mapped`   | ✅       | `icon=error` 映射为 `fail` 后调用 `tt.showToast`                       |
| `startAccelerometer`                          | `startAccelerometer`                | ✅   | `native`   | ✅       | 直连 `tt.startAccelerometer`                                           |
| `startBeaconDiscovery`                        | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `startBluetoothDevicesDiscovery`              | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `startCompass`                                | `startCompass`                      | ✅   | `native`   | ✅       | 直连 `tt.startCompass`                                                 |
| `startDeviceMotionListening`                  | `startDeviceMotionListening`        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startGyroscope`                              | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `startHCE`                                    | `startHCE`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocalServiceDiscovery`                  | `startLocalServiceDiscovery`        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocationUpdate`                         | `startLocationUpdate`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocationUpdateBackground`               | `startLocationUpdateBackground`     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startPullDownRefresh`                        | `startPullDownRefresh`              | ✅   | `native`   | ✅       | 直连 `tt.startPullDownRefresh`                                         |
| `startRecord`                                 | `startRecord`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startSoterAuthentication`                    | `startSoterAuthentication`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startWifi`                                   | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `stopAccelerometer`                           | `stopAccelerometer`                 | ✅   | `native`   | ✅       | 直连 `tt.stopAccelerometer`                                            |
| `stopBackgroundAudio`                         | `stopBackgroundAudio`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopBeaconDiscovery`                         | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `stopBluetoothDevicesDiscovery`               | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `stopCompass`                                 | `stopCompass`                       | ✅   | `native`   | ✅       | 直连 `tt.stopCompass`                                                  |
| `stopDeviceMotionListening`                   | `stopDeviceMotionListening`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopFaceDetect`                              | `stopFaceDetect`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopGyroscope`                               | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `stopHCE`                                     | `stopHCE`                           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopLocalServiceDiscovery`                   | `stopLocalServiceDiscovery`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopLocationUpdate`                          | `stopLocationUpdate`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopPullDownRefresh`                         | `stopPullDownRefresh`               | ✅   | `native`   | ✅       | 直连 `tt.stopPullDownRefresh`                                          |
| `stopRecord`                                  | `stopRecord`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopVoice`                                   | `stopVoice`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopWifi`                                    | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
| `subscribeVoIPVideoMembers`                   | `subscribeVoIPVideoMembers`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `switchTab`                                   | `switchTab`                         | ✅   | `native`   | ✅       | 直连 `tt.switchTab`                                                    |
| `updateShareMenu`                             | `showShareMenu`                     | ✅   | `mapped`   | ✅       | 映射到 `tt.showShareMenu`                                              |
| `updateVoIPChatMuteConfig`                    | `updateVoIPChatMuteConfig`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `updateWeChatApp`                             | `updateWeChatApp`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `uploadFile`                                  | `uploadFile`                        | ✅   | `native`   | ✅       | 直连 `tt.uploadFile`                                                   |
| `vibrateLong`                                 | `vibrateLong`                       | ✅   | `native`   | ✅       | 直连 `tt.vibrateLong`                                                  |
| `vibrateShort`                                | `vibrateShort`                      | ✅   | `native`   | ✅       | 直连 `tt.vibrateShort`                                                 |
| `writeBLECharacteristicValue`                 | `hideToast`                         | ✅   | `fallback` | ❌       | 回退映射到 `tt.hideToast`（通用兜底）                                  |
