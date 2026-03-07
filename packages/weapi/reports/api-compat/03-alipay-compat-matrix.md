# 03 支付宝兼容矩阵（按微信命名）

总计：479，支持：479，不支持：0

| 微信 API                                      | 支付宝目标 API                       | 支持 | 支持级别   | 语义对齐 | 策略                                                                   |
| --------------------------------------------- | ------------------------------------ | ---- | ---------- | -------- | ---------------------------------------------------------------------- |
| `addCard`                                     | `addCard`                            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addFileToFavorites`                          | `addFileToFavorites`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPaymentPassFinish`                        | `addPaymentPassFinish`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPaymentPassGetCertificateData`            | `addPaymentPassGetCertificateData`   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneCalendar`                            | `addPhoneCalendar`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addPhoneContact`                             | `addPhoneContact`                    | ✅   | `mapped`   | ✅       | 直连 `my.addPhoneContact`                                              |
| `addPhoneRepeatCalendar`                      | `addPhoneRepeatCalendar`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `addVideoToFavorites`                         | `addVideoToFavorites`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `arrayBufferToBase64`                         | `arrayBufferToBase64`                | ✅   | `native`   | ✅       | 直连 `my.arrayBufferToBase64`                                          |
| `authorize`                                   | `getAuthCode`                        | ✅   | `mapped`   | ✅       | 映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数               |
| `authorizeForMiniProgram`                     | `authorizeForMiniProgram`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `authPrivateMessage`                          | `authPrivateMessage`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `base64ToArrayBuffer`                         | `base64ToArrayBuffer`                | ✅   | `native`   | ✅       | 直连 `my.base64ToArrayBuffer`                                          |
| `batchGetStorage`                             | `batchGetStorage`                    | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `my.getStorage`                                |
| `batchGetStorageSync`                         | `batchGetStorageSync`                | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `my.getStorageSync`                            |
| `batchSetStorage`                             | `batchSetStorage`                    | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `my.setStorage`                                |
| `batchSetStorageSync`                         | `batchSetStorageSync`                | ✅   | `mapped`   | ✅       | 使用内置 shim，逐项转调 `my.setStorageSync`                            |
| `bindEmployeeRelation`                        | `bindEmployeeRelation`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canAddSecureElementPass`                     | `canAddSecureElementPass`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `cancelIdleCallback`                          | `cancelIdleCallback`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canIUse`                                     | `canIUse`                            | ✅   | `native`   | ✅       | 直连 `my.canIUse`                                                      |
| `canvasGetImageData`                          | `canvasGetImageData`                 | ✅   | `mapped`   | ✅       | 使用内置 shim，返回空像素数据结构                                      |
| `canvasPutImageData`                          | `canvasPutImageData`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `canvasToTempFilePath`                        | `canvasToTempFilePath`               | ✅   | `native`   | ✅       | 直连 `my.canvasToTempFilePath`                                         |
| `checkDeviceSupportHevc`                      | `checkDeviceSupportHevc`             | ✅   | `mapped`   | ✅       | 使用内置 shim，返回默认不支持                                          |
| `checkEmployeeRelation`                       | `checkEmployeeRelation`              | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未绑定                                              |
| `checkIsAddedToMyMiniProgram`                 | `checkIsAddedToMyMiniProgram`        | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未添加                                              |
| `checkIsOpenAccessibility`                    | `checkIsOpenAccessibility`           | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未开启                                              |
| `checkIsPictureInPictureActive`               | `checkIsPictureInPictureActive`      | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未激活                                              |
| `checkIsSoterEnrolledInDevice`                | `checkIsSoterEnrolledInDevice`       | ✅   | `mapped`   | ✅       | 使用内置 shim，返回未录入                                              |
| `checkIsSupportSoterAuthentication`           | `checkIsSupportSoterAuthentication`  | ✅   | `mapped`   | ✅       | 使用内置 shim，返回默认不支持                                          |
| `checkSession`                                | `getAuthCode`                        | ✅   | `mapped`   | ✅       | 映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok`              |
| `chooseAddress`                               | `getAddress`                         | ✅   | `mapped`   | ✅       | 映射到 `my.getAddress`                                                 |
| `chooseContact`                               | `chooseContact`                      | ✅   | `native`   | ✅       | 直连 `my.chooseContact`                                                |
| `chooseImage`                                 | `chooseImage`                        | ✅   | `mapped`   | ✅       | 返回值 `apFilePaths` 映射到 `tempFilePaths`                            |
| `chooseInvoice`                               | `hideToast`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.hideToast`（通用兜底）                                  |
| `chooseInvoiceTitle`                          | `chooseInvoiceTitle`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseLicensePlate`                          | `chooseLicensePlate`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseLocation`                              | `chooseLocation`                     | ✅   | `native`   | ✅       | 直连 `my.chooseLocation`                                               |
| `chooseMedia`                                 | `chooseImage`                        | ✅   | `mapped`   | ✅       | 映射到 `my.chooseImage`，并补齐 `tempFiles[].tempFilePath/fileType`    |
| `chooseMessageFile`                           | `chooseImage`                        | ✅   | `mapped`   | ✅       | 映射到 `my.chooseImage`，并补齐 `tempFiles[].path/name`                |
| `choosePoi`                                   | `choosePoi`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `chooseVideo`                                 | `chooseVideo`                        | ✅   | `mapped`   | ✅       | 直连 `my.chooseVideo`                                                  |
| `clearStorage`                                | `clearStorage`                       | ✅   | `native`   | ✅       | 直连 `my.clearStorage`                                                 |
| `clearStorageSync`                            | `clearStorageSync`                   | ✅   | `native`   | ✅       | 直连 `my.clearStorageSync`                                             |
| `closeBLEConnection`                          | `closeBLEConnection`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `closeBluetoothAdapter`                       | `closeBluetoothAdapter`              | ✅   | `native`   | ✅       | 直连 `my.closeBluetoothAdapter`                                        |
| `closeSocket`                                 | `closeSocket`                        | ✅   | `native`   | ✅       | 直连 `my.closeSocket`                                                  |
| `compressImage`                               | `compressImage`                      | ✅   | `native`   | ✅       | 直连 `my.compressImage`                                                |
| `compressVideo`                               | `compressVideo`                      | ✅   | `mapped`   | ✅       | 使用内置 shim（回传原始文件路径）                                      |
| `connectSocket`                               | `connectSocket`                      | ✅   | `native`   | ✅       | 直连 `my.connectSocket`                                                |
| `connectWifi`                                 | `connectWifi`                        | ✅   | `native`   | ✅       | 直连 `my.connectWifi`                                                  |
| `createAnimation`                             | `createAnimation`                    | ✅   | `native`   | ✅       | 直连 `my.createAnimation`                                              |
| `createAudioContext`                          | `createInnerAudioContext`            | ✅   | `mapped`   | ✅       | 映射到 `my.createInnerAudioContext`                                    |
| `createBLEConnection`                         | `createBLEConnection`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createBLEPeripheralServer`                   | `createBLEPeripheralServer`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createBufferURL`                             | `createBufferURL`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createCacheManager`                          | `createCacheManager`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createCameraContext`                         | `createCameraContext`                | ✅   | `mapped`   | ✅       | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） |
| `createCanvasContext`                         | `createCanvasContext`                | ✅   | `native`   | ✅       | 直连 `my.createCanvasContext`                                          |
| `createGlobalPayment`                         | `createGlobalPayment`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createInferenceSession`                      | `createInferenceSession`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createInnerAudioContext`                     | `createInnerAudioContext`            | ✅   | `native`   | ✅       | 直连 `my.createInnerAudioContext`                                      |
| `createIntersectionObserver`                  | `createIntersectionObserver`         | ✅   | `native`   | ✅       | 直连 `my.createIntersectionObserver`                                   |
| `createInterstitialAd`                        | `createRewardedAd`                   | ✅   | `mapped`   | ✅       | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`                    |
| `createLivePlayerContext`                     | `createVideoContext`                 | ✅   | `mapped`   | ✅       | 映射到 `my.createVideoContext`                                         |
| `createLivePusherContext`                     | `createVideoContext`                 | ✅   | `mapped`   | ✅       | 映射到 `my.createVideoContext`                                         |
| `createMapContext`                            | `createMapContext`                   | ✅   | `native`   | ✅       | 直连 `my.createMapContext`                                             |
| `createMediaAudioPlayer`                      | `createMediaAudioPlayer`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createMediaContainer`                        | `createMediaContainer`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createMediaRecorder`                         | `createMediaRecorder`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createOffscreenCanvas`                       | `createOffscreenCanvas`              | ✅   | `native`   | ✅       | 直连 `my.createOffscreenCanvas`                                        |
| `createRewardedVideoAd`                       | `createRewardedAd`                   | ✅   | `mapped`   | ✅       | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`                    |
| `createSelectorQuery`                         | `createSelectorQuery`                | ✅   | `native`   | ✅       | 直连 `my.createSelectorQuery`                                          |
| `createTCPSocket`                             | `createTCPSocket`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createUDPSocket`                             | `createUDPSocket`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createVideoContext`                          | `createVideoContext`                 | ✅   | `native`   | ✅       | 直连 `my.createVideoContext`                                           |
| `createVideoDecoder`                          | `createVideoDecoder`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `createVKSession`                             | `createVKSession`                    | ✅   | `mapped`   | ✅       | 使用内置 VKSession shim（对齐 `start/stop/destroy`）                   |
| `createWebAudioContext`                       | `createInnerAudioContext`            | ✅   | `mapped`   | ✅       | 映射到 `my.createInnerAudioContext`                                    |
| `createWorker`                                | `createWorker`                       | ✅   | `native`   | ✅       | 直连 `my.createWorker`                                                 |
| `cropImage`                                   | `cropImage`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `disableAlertBeforeUnload`                    | `disableAlertBeforeUnload`           | ✅   | `native`   | ✅       | 直连 `my.disableAlertBeforeUnload`                                     |
| `downloadFile`                                | `downloadFile`                       | ✅   | `native`   | ✅       | 直连 `my.downloadFile`                                                 |
| `editImage`                                   | `editImage`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `enableAlertBeforeUnload`                     | `enableAlertBeforeUnload`            | ✅   | `native`   | ✅       | 直连 `my.enableAlertBeforeUnload`                                      |
| `exitMiniProgram`                             | `exitMiniProgram`                    | ✅   | `native`   | ✅       | 直连 `my.exitMiniProgram`                                              |
| `exitVoIPChat`                                | `exitVoIPChat`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `faceDetect`                                  | `faceDetect`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getAccountInfoSync`                          | `getAccountInfoSync`                 | ✅   | `mapped`   | ✅       | 直连 `my.getAccountInfoSync`                                           |
| `getApiCategory`                              | `getApiCategory`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getAppAuthorizeSetting`                      | `getAppAuthorizeSetting`             | ✅   | `mapped`   | ✅       | 直连 `my.getAppAuthorizeSetting`                                       |
| `getAppBaseInfo`                              | `getAppBaseInfo`                     | ✅   | `mapped`   | ✅       | 直连 `my.getAppBaseInfo`                                               |
| `getAvailableAudioSources`                    | `getAvailableAudioSources`           | ✅   | `native`   | ✅       | 直连 `my.getAvailableAudioSources`                                     |
| `getBackgroundAudioManager`                   | `getBackgroundAudioManager`          | ✅   | `native`   | ✅       | 直连 `my.getBackgroundAudioManager`                                    |
| `getBackgroundAudioPlayerState`               | `getBackgroundAudioPlayerState`      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getBackgroundFetchData`                      | `getBackgroundFetchData`             | ✅   | `native`   | ✅       | 直连 `my.getBackgroundFetchData`                                       |
| `getBackgroundFetchToken`                     | `getBackgroundFetchToken`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getBatteryInfo`                              | `getBatteryInfo`                     | ✅   | `mapped`   | ✅       | 直连 `my.getBatteryInfo`                                               |
| `getBatteryInfoSync`                          | `getBatteryInfoSync`                 | ✅   | `mapped`   | ✅       | 直连 `my.getBatteryInfoSync`                                           |
| `getBeacons`                                  | `getBeacons`                         | ✅   | `native`   | ✅       | 直连 `my.getBeacons`                                                   |
| `getBLEDeviceCharacteristics`                 | `getBLEDeviceCharacteristics`        | ✅   | `native`   | ✅       | 直连 `my.getBLEDeviceCharacteristics`                                  |
| `getBLEDeviceRSSI`                            | `getBLEDeviceRSSI`                   | ✅   | `native`   | ✅       | 直连 `my.getBLEDeviceRSSI`                                             |
| `getBLEDeviceServices`                        | `getBLEDeviceServices`               | ✅   | `native`   | ✅       | 直连 `my.getBLEDeviceServices`                                         |
| `getBLEMTU`                                   | `getBLEMTU`                          | ✅   | `native`   | ✅       | 直连 `my.getBLEMTU`                                                    |
| `getBluetoothAdapterState`                    | `getBluetoothAdapterState`           | ✅   | `native`   | ✅       | 直连 `my.getBluetoothAdapterState`                                     |
| `getBluetoothDevices`                         | `getBluetoothDevices`                | ✅   | `native`   | ✅       | 直连 `my.getBluetoothDevices`                                          |
| `getChannelsLiveInfo`                         | `getChannelsLiveInfo`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsLiveNoticeInfo`                   | `getChannelsLiveNoticeInfo`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChannelsShareKey`                         | `getChannelsShareKey`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getChatToolInfo`                             | `getChatToolInfo`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getClipboardData`                            | `getClipboard`                       | ✅   | `mapped`   | ✅       | 转调 `my.getClipboard` 并映射 `text` → `data`                          |
| `getCommonConfig`                             | `getCommonConfig`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getConnectedBluetoothDevices`                | `getConnectedBluetoothDevices`       | ✅   | `native`   | ✅       | 直连 `my.getConnectedBluetoothDevices`                                 |
| `getConnectedWifi`                            | `getConnectedWifi`                   | ✅   | `native`   | ✅       | 直连 `my.getConnectedWifi`                                             |
| `getDeviceBenchmarkInfo`                      | `getDeviceBenchmarkInfo`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getDeviceInfo`                               | `getSystemInfo`                      | ✅   | `mapped`   | ✅       | 映射到 `my.getSystemInfo`，并提取设备字段                              |
| `getDeviceVoIPList`                           | `getDeviceVoIPList`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getEnterOptionsSync`                         | `getEnterOptionsSync`                | ✅   | `mapped`   | ✅       | 直连 `my.getEnterOptionsSync`                                          |
| `getExptInfoSync`                             | `getSystemInfoSync`                  | ✅   | `fallback` | ❌       | 回退映射到 `my.getSystemInfoSync`（通用兜底）                          |
| `getExtConfig`                                | `getExtConfig`                       | ✅   | `native`   | ✅       | 直连 `my.getExtConfig`                                                 |
| `getExtConfigSync`                            | `getExtConfigSync`                   | ✅   | `native`   | ✅       | 直连 `my.getExtConfigSync`                                             |
| `getFileSystemManager`                        | `getFileSystemManager`               | ✅   | `native`   | ✅       | 直连 `my.getFileSystemManager`                                         |
| `getFuzzyLocation`                            | `getLocation`                        | ✅   | `mapped`   | ✅       | 映射到 `my.getLocation`                                                |
| `getGroupEnterInfo`                           | `getGroupEnterInfo`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getHCEState`                                 | `getHCEState`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getImageInfo`                                | `getImageInfo`                       | ✅   | `native`   | ✅       | 直连 `my.getImageInfo`                                                 |
| `getInferenceEnvInfo`                         | `getInferenceEnvInfo`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getLaunchOptionsSync`                        | `getLaunchOptionsSync`               | ✅   | `native`   | ✅       | 直连 `my.getLaunchOptionsSync`                                         |
| `getLocalIPAddress`                           | `getLocalIPAddress`                  | ✅   | `native`   | ✅       | 直连 `my.getLocalIPAddress`                                            |
| `getLocation`                                 | `getLocation`                        | ✅   | `native`   | ✅       | 直连 `my.getLocation`                                                  |
| `getLogManager`                               | `getLogManager`                      | ✅   | `mapped`   | ✅       | 使用内置日志 shim（对齐 `log/info/warn/error`）                        |
| `getMenuButtonBoundingClientRect`             | `getMenuButtonBoundingClientRect`    | ✅   | `native`   | ✅       | 直连 `my.getMenuButtonBoundingClientRect`                              |
| `getNetworkType`                              | `getNetworkType`                     | ✅   | `mapped`   | ✅       | 直连 `my.getNetworkType`                                               |
| `getNFCAdapter`                               | `getNFCAdapter`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getPerformance`                              | `getPerformance`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getPrivacySetting`                           | `getPrivacySetting`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRandomValues`                             | `getRandomValues`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRealtimeLogManager`                       | `getRealtimeLogManager`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getRecorderManager`                          | `getRecorderManager`                 | ✅   | `native`   | ✅       | 直连 `my.getRecorderManager`                                           |
| `getRendererUserAgent`                        | `getRendererUserAgent`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getScreenBrightness`                         | `getScreenBrightness`                | ✅   | `native`   | ✅       | 直连 `my.getScreenBrightness`                                          |
| `getScreenRecordingState`                     | `getScreenRecordingState`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSecureElementPasses`                      | `getSecureElementPasses`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSelectedTextRange`                        | `getSelectedTextRange`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSetting`                                  | `getSetting`                         | ✅   | `native`   | ✅       | 直连 `my.getSetting`                                                   |
| `getShareInfo`                                | `getShareInfo`                       | ✅   | `mapped`   | ✅       | 使用内置 shim（补齐 `encryptedData/iv`）                               |
| `getShowSplashAdStatus`                       | `getShowSplashAdStatus`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSkylineInfo`                              | `getSkylineInfo`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getSkylineInfoSync`                          | `getSystemInfoSync`                  | ✅   | `fallback` | ❌       | 回退映射到 `my.getSystemInfoSync`（通用兜底）                          |
| `getStorage`                                  | `getStorage`                         | ✅   | `native`   | ✅       | 直连 `my.getStorage`                                                   |
| `getStorageInfo`                              | `getStorageInfo`                     | ✅   | `native`   | ✅       | 直连 `my.getStorageInfo`                                               |
| `getStorageInfoSync`                          | `getStorageInfoSync`                 | ✅   | `native`   | ✅       | 直连 `my.getStorageInfoSync`                                           |
| `getStorageSync`                              | `getStorageSync`                     | ✅   | `native`   | ✅       | 直连 `my.getStorageSync`                                               |
| `getSystemInfo`                               | `getSystemInfo`                      | ✅   | `native`   | ✅       | 直连 `my.getSystemInfo`                                                |
| `getSystemInfoAsync`                          | `getSystemInfo`                      | ✅   | `mapped`   | ✅       | 映射到 `my.getSystemInfo`                                              |
| `getSystemInfoSync`                           | `getSystemInfoSync`                  | ✅   | `native`   | ✅       | 直连 `my.getSystemInfoSync`                                            |
| `getSystemSetting`                            | `getSystemSetting`                   | ✅   | `mapped`   | ✅       | 直连 `my.getSystemSetting`                                             |
| `getUpdateManager`                            | `getUpdateManager`                   | ✅   | `native`   | ✅       | 直连 `my.getUpdateManager`                                             |
| `getUserCryptoManager`                        | `getUserCryptoManager`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getUserInfo`                                 | `getOpenUserInfo`                    | ✅   | `mapped`   | ✅       | 映射到 `my.getOpenUserInfo`                                            |
| `getUserProfile`                              | `getOpenUserInfo`                    | ✅   | `mapped`   | ✅       | 映射到 `my.getOpenUserInfo`                                            |
| `getVideoInfo`                                | `getVideoInfo`                       | ✅   | `mapped`   | ✅       | 直连 `my.getVideoInfo`                                                 |
| `getWeRunData`                                | `getWeRunData`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `getWifiList`                                 | `getWifiList`                        | ✅   | `native`   | ✅       | 直连 `my.getWifiList`                                                  |
| `getWindowInfo`                               | `getWindowInfo`                      | ✅   | `mapped`   | ✅       | 直连 `my.getWindowInfo`                                                |
| `getXrFrameSystem`                            | `getXrFrameSystem`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `hideHomeButton`                              | `hideBackHome`                       | ✅   | `mapped`   | ✅       | 映射到 `my.hideBackHome`                                               |
| `hideKeyboard`                                | `hideKeyboard`                       | ✅   | `native`   | ✅       | 直连 `my.hideKeyboard`                                                 |
| `hideLoading`                                 | `hideLoading`                        | ✅   | `native`   | ✅       | 直连 `my.hideLoading`                                                  |
| `hideNavigationBarLoading`                    | `hideNavigationBarLoading`           | ✅   | `native`   | ✅       | 直连 `my.hideNavigationBarLoading`                                     |
| `hideShareMenu`                               | `hideShareMenu`                      | ✅   | `native`   | ✅       | 直连 `my.hideShareMenu`                                                |
| `hideTabBar`                                  | `hideTabBar`                         | ✅   | `native`   | ✅       | 直连 `my.hideTabBar`                                                   |
| `hideTabBarRedDot`                            | `hideTabBarRedDot`                   | ✅   | `native`   | ✅       | 直连 `my.hideTabBarRedDot`                                             |
| `hideToast`                                   | `hideToast`                          | ✅   | `native`   | ✅       | 直连 `my.hideToast`                                                    |
| `initFaceDetect`                              | `initFaceDetect`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `isBluetoothDevicePaired`                     | `isBluetoothDevicePaired`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `isVKSupport`                                 | `isVKSupport`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `join1v1Chat`                                 | `join1v1Chat`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `joinVoIPChat`                                | `joinVoIPChat`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `loadBuiltInFontFace`                         | `loadBuiltInFontFace`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `loadFontFace`                                | `loadFontFace`                       | ✅   | `native`   | ✅       | 直连 `my.loadFontFace`                                                 |
| `login`                                       | `getAuthCode`                        | ✅   | `mapped`   | ✅       | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段                        |
| `makeBluetoothPair`                           | `makeBluetoothPair`                  | ✅   | `native`   | ✅       | 直连 `my.makeBluetoothPair`                                            |
| `makePhoneCall`                               | `makePhoneCall`                      | ✅   | `native`   | ✅       | 直连 `my.makePhoneCall`                                                |
| `navigateBack`                                | `navigateBack`                       | ✅   | `native`   | ✅       | 直连 `my.navigateBack`                                                 |
| `navigateBackMiniProgram`                     | `navigateBackMiniProgram`            | ✅   | `native`   | ✅       | 直连 `my.navigateBackMiniProgram`                                      |
| `navigateTo`                                  | `navigateTo`                         | ✅   | `native`   | ✅       | 直连 `my.navigateTo`                                                   |
| `navigateToMiniProgram`                       | `navigateToMiniProgram`              | ✅   | `native`   | ✅       | 直连 `my.navigateToMiniProgram`                                        |
| `nextTick`                                    | `nextTick`                           | ✅   | `mapped`   | ✅       | 使用内置 microtask shim 调度回调                                       |
| `notifyBLECharacteristicValueChange`          | `notifyBLECharacteristicValueChange` | ✅   | `native`   | ✅       | 直连 `my.notifyBLECharacteristicValueChange`                           |
| `notifyGroupMembers`                          | `notifyGroupMembers`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `offAccelerometerChange`                      | `offAccelerometerChange`             | ✅   | `native`   | ✅       | 直连 `my.offAccelerometerChange`                                       |
| `offAfterPageLoad`                            | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offAfterPageUnload`                          | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offApiCategoryChange`                        | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offAppHide`                                  | `offAppHide`                         | ✅   | `native`   | ✅       | 直连 `my.offAppHide`                                                   |
| `offAppRoute`                                 | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offAppRouteDone`                             | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offAppShow`                                  | `offAppShow`                         | ✅   | `native`   | ✅       | 直连 `my.offAppShow`                                                   |
| `offAudioInterruptionBegin`                   | `offAudioInterruptionBegin`          | ✅   | `native`   | ✅       | 直连 `my.offAudioInterruptionBegin`                                    |
| `offAudioInterruptionEnd`                     | `offAudioInterruptionEnd`            | ✅   | `native`   | ✅       | 直连 `my.offAudioInterruptionEnd`                                      |
| `offBatteryInfoChange`                        | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBeaconServiceChange`                      | `offBeaconServiceChange`             | ✅   | `native`   | ✅       | 直连 `my.offBeaconServiceChange`                                       |
| `offBeaconUpdate`                             | `offBeaconUpdate`                    | ✅   | `native`   | ✅       | 直连 `my.offBeaconUpdate`                                              |
| `offBeforeAppRoute`                           | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBeforePageLoad`                           | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBeforePageUnload`                         | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBLECharacteristicValueChange`             | `offBLECharacteristicValueChange`    | ✅   | `native`   | ✅       | 直连 `my.offBLECharacteristicValueChange`                              |
| `offBLEConnectionStateChange`                 | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBLEMTUChange`                             | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBLEPeripheralConnectionStateChanged`      | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offBluetoothAdapterStateChange`              | `offBluetoothAdapterStateChange`     | ✅   | `native`   | ✅       | 直连 `my.offBluetoothAdapterStateChange`                               |
| `offBluetoothDeviceFound`                     | `offBluetoothDeviceFound`            | ✅   | `native`   | ✅       | 直连 `my.offBluetoothDeviceFound`                                      |
| `offCompassChange`                            | `offCompassChange`                   | ✅   | `native`   | ✅       | 直连 `my.offCompassChange`                                             |
| `offCopyUrl`                                  | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offDeviceMotionChange`                       | `offDeviceMotionChange`              | ✅   | `native`   | ✅       | 直连 `my.offDeviceMotionChange`                                        |
| `offEmbeddedMiniProgramHeightChange`          | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offError`                                    | `offError`                           | ✅   | `native`   | ✅       | 直连 `my.offError`                                                     |
| `offGeneratePoster`                           | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offGetWifiList`                              | `offGetWifiList`                     | ✅   | `native`   | ✅       | 直连 `my.offGetWifiList`                                               |
| `offGyroscopeChange`                          | `offGyroscopeChange`                 | ✅   | `native`   | ✅       | 直连 `my.offGyroscopeChange`                                           |
| `offHCEMessage`                               | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offKeyboardHeightChange`                     | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offKeyDown`                                  | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offKeyUp`                                    | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLazyLoadError`                            | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLocalServiceDiscoveryStop`                | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLocalServiceFound`                        | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLocalServiceLost`                         | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLocalServiceResolveFail`                  | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLocationChange`                           | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offLocationChangeError`                      | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offMemoryWarning`                            | `offMemoryWarning`                   | ✅   | `mapped`   | ✅       | 直连 `my.offMemoryWarning`                                             |
| `offMenuButtonBoundingClientRectWeightChange` | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offNetworkStatusChange`                      | `offNetworkStatusChange`             | ✅   | `native`   | ✅       | 直连 `my.offNetworkStatusChange`                                       |
| `offNetworkWeakChange`                        | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offOnUserTriggerTranslation`                 | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offPageNotFound`                             | `offPageNotFound`                    | ✅   | `native`   | ✅       | 直连 `my.offPageNotFound`                                              |
| `offParallelStateChange`                      | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offScreenRecordingStateChanged`              | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offThemeChange`                              | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offUnhandledRejection`                       | `offUnhandledRejection`              | ✅   | `native`   | ✅       | 直连 `my.offUnhandledRejection`                                        |
| `offUserCaptureScreen`                        | `offUserCaptureScreen`               | ✅   | `native`   | ✅       | 直连 `my.offUserCaptureScreen`                                         |
| `offVoIPChatInterrupted`                      | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offVoIPChatMembersChanged`                   | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offVoIPChatSpeakersChanged`                  | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offVoIPChatStateChanged`                     | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offVoIPVideoMembersChanged`                  | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offWifiConnected`                            | `offWifiConnected`                   | ✅   | `native`   | ✅       | 直连 `my.offWifiConnected`                                             |
| `offWifiConnectedWithPartialInfo`             | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `offWindowResize`                             | `offWindowResize`                    | ✅   | `mapped`   | ✅       | 使用内置 shim，移除 `onWindowResize` 注册回调                          |
| `offWindowStateChange`                        | `offAppShow`                         | ✅   | `fallback` | ❌       | 回退映射到 `my.offAppShow`（通用兜底）                                 |
| `onAccelerometerChange`                       | `onAccelerometerChange`              | ✅   | `native`   | ✅       | 直连 `my.onAccelerometerChange`                                        |
| `onAfterPageLoad`                             | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onAfterPageUnload`                           | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onApiCategoryChange`                         | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onAppHide`                                   | `onAppHide`                          | ✅   | `native`   | ✅       | 直连 `my.onAppHide`                                                    |
| `onAppRoute`                                  | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onAppRouteDone`                              | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onAppShow`                                   | `onAppShow`                          | ✅   | `native`   | ✅       | 直连 `my.onAppShow`                                                    |
| `onAudioInterruptionBegin`                    | `onAudioInterruptionBegin`           | ✅   | `native`   | ✅       | 直连 `my.onAudioInterruptionBegin`                                     |
| `onAudioInterruptionEnd`                      | `onAudioInterruptionEnd`             | ✅   | `native`   | ✅       | 直连 `my.onAudioInterruptionEnd`                                       |
| `onBackgroundAudioPause`                      | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBackgroundAudioPlay`                       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBackgroundAudioStop`                       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBackgroundFetchData`                       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBatteryInfoChange`                         | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBeaconServiceChange`                       | `onBeaconServiceChange`              | ✅   | `native`   | ✅       | 直连 `my.onBeaconServiceChange`                                        |
| `onBeaconUpdate`                              | `onBeaconUpdate`                     | ✅   | `native`   | ✅       | 直连 `my.onBeaconUpdate`                                               |
| `onBeforeAppRoute`                            | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBeforePageLoad`                            | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBeforePageUnload`                          | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBLECharacteristicValueChange`              | `onBLECharacteristicValueChange`     | ✅   | `native`   | ✅       | 直连 `my.onBLECharacteristicValueChange`                               |
| `onBLEConnectionStateChange`                  | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBLEMTUChange`                              | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBLEPeripheralConnectionStateChanged`       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onBluetoothAdapterStateChange`               | `onBluetoothAdapterStateChange`      | ✅   | `native`   | ✅       | 直连 `my.onBluetoothAdapterStateChange`                                |
| `onBluetoothDeviceFound`                      | `onBluetoothDeviceFound`             | ✅   | `native`   | ✅       | 直连 `my.onBluetoothDeviceFound`                                       |
| `onCompassChange`                             | `onCompassChange`                    | ✅   | `native`   | ✅       | 直连 `my.onCompassChange`                                              |
| `onCopyUrl`                                   | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onDeviceMotionChange`                        | `onDeviceMotionChange`               | ✅   | `native`   | ✅       | 直连 `my.onDeviceMotionChange`                                         |
| `onEmbeddedMiniProgramHeightChange`           | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onError`                                     | `onError`                            | ✅   | `native`   | ✅       | 直连 `my.onError`                                                      |
| `onGeneratePoster`                            | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onGetWifiList`                               | `onGetWifiList`                      | ✅   | `native`   | ✅       | 直连 `my.onGetWifiList`                                                |
| `onGyroscopeChange`                           | `onGyroscopeChange`                  | ✅   | `native`   | ✅       | 直连 `my.onGyroscopeChange`                                            |
| `onHCEMessage`                                | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onKeyboardHeightChange`                      | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onKeyDown`                                   | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onKeyUp`                                     | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLazyLoadError`                             | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLocalServiceDiscoveryStop`                 | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLocalServiceFound`                         | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLocalServiceLost`                          | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLocalServiceResolveFail`                   | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLocationChange`                            | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onLocationChangeError`                       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onMemoryWarning`                             | `onMemoryWarning`                    | ✅   | `native`   | ✅       | 直连 `my.onMemoryWarning`                                              |
| `onMenuButtonBoundingClientRectWeightChange`  | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onNeedPrivacyAuthorization`                  | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onNetworkStatusChange`                       | `onNetworkStatusChange`              | ✅   | `native`   | ✅       | 直连 `my.onNetworkStatusChange`                                        |
| `onNetworkWeakChange`                         | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onOnUserTriggerTranslation`                  | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onPageNotFound`                              | `onPageNotFound`                     | ✅   | `native`   | ✅       | 直连 `my.onPageNotFound`                                               |
| `onParallelStateChange`                       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onScreenRecordingStateChanged`               | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onSocketClose`                               | `onSocketClose`                      | ✅   | `native`   | ✅       | 直连 `my.onSocketClose`                                                |
| `onSocketError`                               | `onSocketError`                      | ✅   | `native`   | ✅       | 直连 `my.onSocketError`                                                |
| `onSocketMessage`                             | `onSocketMessage`                    | ✅   | `native`   | ✅       | 直连 `my.onSocketMessage`                                              |
| `onSocketOpen`                                | `onSocketOpen`                       | ✅   | `native`   | ✅       | 直连 `my.onSocketOpen`                                                 |
| `onThemeChange`                               | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onUnhandledRejection`                        | `onUnhandledRejection`               | ✅   | `native`   | ✅       | 直连 `my.onUnhandledRejection`                                         |
| `onUserCaptureScreen`                         | `onUserCaptureScreen`                | ✅   | `native`   | ✅       | 直连 `my.onUserCaptureScreen`                                          |
| `onVoIPChatInterrupted`                       | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onVoIPChatMembersChanged`                    | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onVoIPChatSpeakersChanged`                   | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onVoIPChatStateChanged`                      | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onVoIPVideoMembersChanged`                   | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onWifiConnected`                             | `onWifiConnected`                    | ✅   | `native`   | ✅       | 直连 `my.onWifiConnected`                                              |
| `onWifiConnectedWithPartialInfo`              | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `onWindowResize`                              | `onWindowResize`                     | ✅   | `mapped`   | ✅       | 使用内置 shim，通过 `my.onAppShow + my.getWindowInfo` 近似监听         |
| `onWindowStateChange`                         | `onAppShow`                          | ✅   | `fallback` | ❌       | 回退映射到 `my.onAppShow`（通用兜底）                                  |
| `openAppAuthorizeSetting`                     | `openSetting`                        | ✅   | `mapped`   | ✅       | 映射到 `my.openSetting`                                                |
| `openBluetoothAdapter`                        | `openBluetoothAdapter`               | ✅   | `native`   | ✅       | 直连 `my.openBluetoothAdapter`                                         |
| `openCard`                                    | `openCard`                           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsActivity`                        | `openChannelsActivity`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsEvent`                           | `openChannelsEvent`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsLive`                            | `openChannelsLive`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsLiveNoticeInfo`                  | `openChannelsLiveNoticeInfo`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChannelsUserProfile`                     | `openChannelsUserProfile`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openChatTool`                                | `openChatTool`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openCustomerServiceChat`                     | `openCustomerServiceChat`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openDocument`                                | `openDocument`                       | ✅   | `mapped`   | ✅       | 直连 `my.openDocument`                                                 |
| `openEmbeddedMiniProgram`                     | `navigateToMiniProgram`              | ✅   | `mapped`   | ✅       | 映射到 `my.navigateToMiniProgram`                                      |
| `openHKOfflinePayView`                        | `openHKOfflinePayView`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openInquiriesTopic`                          | `openInquiriesTopic`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openLocation`                                | `openLocation`                       | ✅   | `native`   | ✅       | 直连 `my.openLocation`                                                 |
| `openOfficialAccountArticle`                  | `openOfficialAccountArticle`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountChat`                     | `openOfficialAccountChat`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openOfficialAccountProfile`                  | `openOfficialAccountProfile`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openPrivacyContract`                         | `openPrivacyContract`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openSetting`                                 | `openSetting`                        | ✅   | `native`   | ✅       | 直连 `my.openSetting`                                                  |
| `openSingleStickerView`                       | `openSingleStickerView`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStickerIPView`                           | `openStickerIPView`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStickerSetView`                          | `openStickerSetView`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStoreCouponDetail`                       | `openStoreCouponDetail`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openStoreOrderDetail`                        | `openStoreOrderDetail`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openSystemBluetoothSetting`                  | `openSystemBluetoothSetting`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `openVideoEditor`                             | `openVideoEditor`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pageScrollTo`                                | `pageScrollTo`                       | ✅   | `native`   | ✅       | 直连 `my.pageScrollTo`                                                 |
| `pauseBackgroundAudio`                        | `pauseBackgroundAudio`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pauseVoice`                                  | `pauseVoice`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `playBackgroundAudio`                         | `playBackgroundAudio`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `playVoice`                                   | `playVoice`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `pluginLogin`                                 | `getAuthCode`                        | ✅   | `mapped`   | ✅       | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段                        |
| `postMessageToReferrerMiniProgram`            | `postMessageToReferrerMiniProgram`   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `postMessageToReferrerPage`                   | `postMessageToReferrerPage`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preDownloadSubpackage`                       | `preDownloadSubpackage`              | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadAssets`                               | `preloadAssets`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadSkylineView`                          | `preloadSkylineView`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `preloadWebview`                              | `preloadWebview`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `previewImage`                                | `previewImage`                       | ✅   | `native`   | ✅       | 直连 `my.previewImage`                                                 |
| `previewMedia`                                | `previewImage`                       | ✅   | `mapped`   | ✅       | 映射到 `my.previewImage`，并将 `sources.url` 对齐到 `urls`             |
| `readBLECharacteristicValue`                  | `readBLECharacteristicValue`         | ✅   | `native`   | ✅       | 直连 `my.readBLECharacteristicValue`                                   |
| `redirectTo`                                  | `redirectTo`                         | ✅   | `native`   | ✅       | 直连 `my.redirectTo`                                                   |
| `reLaunch`                                    | `reLaunch`                           | ✅   | `native`   | ✅       | 直连 `my.reLaunch`                                                     |
| `removeSecureElementPass`                     | `removeSecureElementPass`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `removeStorage`                               | `removeStorage`                      | ✅   | `native`   | ✅       | 直连 `my.removeStorage`                                                |
| `removeStorageSync`                           | `removeStorageSync`                  | ✅   | `native`   | ✅       | 直连 `my.removeStorageSync`                                            |
| `removeTabBarBadge`                           | `removeTabBarBadge`                  | ✅   | `native`   | ✅       | 直连 `my.removeTabBarBadge`                                            |
| `reportAnalytics`                             | `reportAnalytics`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportEvent`                                 | `reportEvent`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportMonitor`                               | `reportMonitor`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reportPerformance`                           | `reportPerformance`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `request`                                     | `request`                            | ✅   | `native`   | ✅       | 直连 `my.request`                                                      |
| `requestCommonPayment`                        | `requestCommonPayment`               | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestDeviceVoIP`                           | `requestDeviceVoIP`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestIdleCallback`                         | `requestIdleCallback`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestMerchantTransfer`                     | `requestMerchantTransfer`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `requestOrderPayment`                         | `tradePay`                           | ✅   | `mapped`   | ✅       | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                |
| `requestPayment`                              | `tradePay`                           | ✅   | `mapped`   | ✅       | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                |
| `requestPluginPayment`                        | `tradePay`                           | ✅   | `mapped`   | ✅       | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                |
| `requestSubscribeDeviceMessage`               | `requestSubscribeMessage`            | ✅   | `mapped`   | ✅       | 映射到 `my.requestSubscribeMessage`                                    |
| `requestSubscribeEmployeeMessage`             | `requestSubscribeMessage`            | ✅   | `mapped`   | ✅       | 映射到 `my.requestSubscribeMessage`                                    |
| `requestSubscribeMessage`                     | `requestSubscribeMessage`            | ✅   | `native`   | ✅       | 直连 `my.requestSubscribeMessage`                                      |
| `requestVirtualPayment`                       | `tradePay`                           | ✅   | `mapped`   | ✅       | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`                |
| `requirePrivacyAuthorize`                     | `requirePrivacyAuthorize`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `reserveChannelsLive`                         | `reserveChannelsLive`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `restartMiniProgram`                          | `reLaunch`                           | ✅   | `mapped`   | ✅       | 映射到 `my.reLaunch`                                                   |
| `revokeBufferURL`                             | `revokeBufferURL`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `rewriteRoute`                                | `rewriteRoute`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `saveFileToDisk`                              | `saveFileToDisk`                     | ✅   | `mapped`   | ✅       | 直连 `my.saveFileToDisk`                                               |
| `saveImageToPhotosAlbum`                      | `saveImageToPhotosAlbum`             | ✅   | `native`   | ✅       | 直连 `my.saveImageToPhotosAlbum`                                       |
| `saveVideoToPhotosAlbum`                      | `saveVideoToPhotosAlbum`             | ✅   | `mapped`   | ✅       | 直连 `my.saveVideoToPhotosAlbum`                                       |
| `scanCode`                                    | `scan`                               | ✅   | `mapped`   | ✅       | 映射到 `my.scan`                                                       |
| `seekBackgroundAudio`                         | `seekBackgroundAudio`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `selectGroupMembers`                          | `selectGroupMembers`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendHCEMessage`                              | `sendHCEMessage`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendSms`                                     | `sendSms`                            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `sendSocketMessage`                           | `sendSocketMessage`                  | ✅   | `native`   | ✅       | 直连 `my.sendSocketMessage`                                            |
| `setBackgroundColor`                          | `setBackgroundColor`                 | ✅   | `mapped`   | ✅       | 直连 `my.setBackgroundColor`                                           |
| `setBackgroundFetchToken`                     | `setBackgroundFetchToken`            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setBackgroundTextStyle`                      | `setBackgroundTextStyle`             | ✅   | `mapped`   | ✅       | 直连 `my.setBackgroundTextStyle`                                       |
| `setBLEMTU`                                   | `setBLEMTU`                          | ✅   | `native`   | ✅       | 直连 `my.setBLEMTU`                                                    |
| `setClipboardData`                            | `setClipboard`                       | ✅   | `mapped`   | ✅       | 转调 `my.setClipboard` 并映射 `data` → `text`                          |
| `setEnable1v1Chat`                            | `setEnable1v1Chat`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setEnableDebug`                              | `setEnableDebug`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setInnerAudioOption`                         | `setInnerAudioOption`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setKeepScreenOn`                             | `setKeepScreenOn`                    | ✅   | `native`   | ✅       | 直连 `my.setKeepScreenOn`                                              |
| `setNavigationBarColor`                       | `setNavigationBarColor`              | ✅   | `native`   | ✅       | 直连 `my.setNavigationBarColor`                                        |
| `setNavigationBarTitle`                       | `setNavigationBarTitle`              | ✅   | `native`   | ✅       | 直连 `my.setNavigationBarTitle`                                        |
| `setScreenBrightness`                         | `setScreenBrightness`                | ✅   | `native`   | ✅       | 直连 `my.setScreenBrightness`                                          |
| `setStorage`                                  | `setStorage`                         | ✅   | `native`   | ✅       | 直连 `my.setStorage`                                                   |
| `setStorageSync`                              | `setStorageSync`                     | ✅   | `native`   | ✅       | 直连 `my.setStorageSync`                                               |
| `setTabBarBadge`                              | `setTabBarBadge`                     | ✅   | `native`   | ✅       | 直连 `my.setTabBarBadge`                                               |
| `setTabBarItem`                               | `setTabBarItem`                      | ✅   | `native`   | ✅       | 直连 `my.setTabBarItem`                                                |
| `setTabBarStyle`                              | `setTabBarStyle`                     | ✅   | `native`   | ✅       | 直连 `my.setTabBarStyle`                                               |
| `setTopBarText`                               | `setTopBarText`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `setVisualEffectOnCapture`                    | `setVisualEffectOnCapture`           | ✅   | `native`   | ✅       | 直连 `my.setVisualEffectOnCapture`                                     |
| `setWifiList`                                 | `setWifiList`                        | ✅   | `native`   | ✅       | 直连 `my.setWifiList`                                                  |
| `setWindowSize`                               | `setWindowSize`                      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareAppMessageToGroup`                      | `shareAppMessageToGroup`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareEmojiToGroup`                           | `shareEmojiToGroup`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareFileMessage`                            | `shareFileMessage`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareFileToGroup`                            | `shareFileToGroup`                   | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareImageToGroup`                           | `shareImageToGroup`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareToOfficialAccount`                      | `shareToOfficialAccount`             | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareToWeRun`                                | `shareToWeRun`                       | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareVideoMessage`                           | `shareVideoMessage`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `shareVideoToGroup`                           | `shareVideoToGroup`                  | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `showActionSheet`                             | `showActionSheet`                    | ✅   | `mapped`   | ✅       | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐                    |
| `showLoading`                                 | `showLoading`                        | ✅   | `mapped`   | ✅       | `title` 映射到 `content` 后调用 `my.showLoading`                       |
| `showModal`                                   | `confirm`                            | ✅   | `mapped`   | ✅       | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果                       |
| `showNavigationBarLoading`                    | `showNavigationBarLoading`           | ✅   | `native`   | ✅       | 直连 `my.showNavigationBarLoading`                                     |
| `showRedPackage`                              | `showRedPackage`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `showShareImageMenu`                          | `showSharePanel`                     | ✅   | `mapped`   | ✅       | 映射到 `my.showSharePanel`                                             |
| `showShareMenu`                               | `showShareMenu`                      | ✅   | `native`   | ✅       | 直连 `my.showShareMenu`                                                |
| `showTabBar`                                  | `showTabBar`                         | ✅   | `native`   | ✅       | 直连 `my.showTabBar`                                                   |
| `showTabBarRedDot`                            | `showTabBarRedDot`                   | ✅   | `native`   | ✅       | 直连 `my.showTabBarRedDot`                                             |
| `showToast`                                   | `showToast`                          | ✅   | `mapped`   | ✅       | `title/icon` 映射到 `content/type` 后调用 `my.showToast`               |
| `startAccelerometer`                          | `startAccelerometer`                 | ✅   | `native`   | ✅       | 直连 `my.startAccelerometer`                                           |
| `startBeaconDiscovery`                        | `startBeaconDiscovery`               | ✅   | `native`   | ✅       | 直连 `my.startBeaconDiscovery`                                         |
| `startBluetoothDevicesDiscovery`              | `startBluetoothDevicesDiscovery`     | ✅   | `native`   | ✅       | 直连 `my.startBluetoothDevicesDiscovery`                               |
| `startCompass`                                | `startCompass`                       | ✅   | `native`   | ✅       | 直连 `my.startCompass`                                                 |
| `startDeviceMotionListening`                  | `startDeviceMotionListening`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startGyroscope`                              | `startGyroscope`                     | ✅   | `native`   | ✅       | 直连 `my.startGyroscope`                                               |
| `startHCE`                                    | `startHCE`                           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocalServiceDiscovery`                  | `startLocalServiceDiscovery`         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocationUpdate`                         | `startLocationUpdate`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startLocationUpdateBackground`               | `startLocationUpdateBackground`      | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startPullDownRefresh`                        | `startPullDownRefresh`               | ✅   | `native`   | ✅       | 直连 `my.startPullDownRefresh`                                         |
| `startRecord`                                 | `startRecord`                        | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startSoterAuthentication`                    | `startSoterAuthentication`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `startWifi`                                   | `startWifi`                          | ✅   | `native`   | ✅       | 直连 `my.startWifi`                                                    |
| `stopAccelerometer`                           | `stopAccelerometer`                  | ✅   | `native`   | ✅       | 直连 `my.stopAccelerometer`                                            |
| `stopBackgroundAudio`                         | `stopBackgroundAudio`                | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopBeaconDiscovery`                         | `stopBeaconDiscovery`                | ✅   | `native`   | ✅       | 直连 `my.stopBeaconDiscovery`                                          |
| `stopBluetoothDevicesDiscovery`               | `stopBluetoothDevicesDiscovery`      | ✅   | `native`   | ✅       | 直连 `my.stopBluetoothDevicesDiscovery`                                |
| `stopCompass`                                 | `stopCompass`                        | ✅   | `native`   | ✅       | 直连 `my.stopCompass`                                                  |
| `stopDeviceMotionListening`                   | `stopDeviceMotionListening`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopFaceDetect`                              | `stopFaceDetect`                     | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopGyroscope`                               | `stopGyroscope`                      | ✅   | `native`   | ✅       | 直连 `my.stopGyroscope`                                                |
| `stopHCE`                                     | `stopHCE`                            | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopLocalServiceDiscovery`                   | `stopLocalServiceDiscovery`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopLocationUpdate`                          | `stopLocationUpdate`                 | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopPullDownRefresh`                         | `stopPullDownRefresh`                | ✅   | `native`   | ✅       | 直连 `my.stopPullDownRefresh`                                          |
| `stopRecord`                                  | `stopRecord`                         | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopVoice`                                   | `stopVoice`                          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `stopWifi`                                    | `stopWifi`                           | ✅   | `native`   | ✅       | 直连 `my.stopWifi`                                                     |
| `subscribeVoIPVideoMembers`                   | `subscribeVoIPVideoMembers`          | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `switchTab`                                   | `switchTab`                          | ✅   | `native`   | ✅       | 直连 `my.switchTab`                                                    |
| `updateShareMenu`                             | `showSharePanel`                     | ✅   | `mapped`   | ✅       | 映射到 `my.showSharePanel`                                             |
| `updateVoIPChatMuteConfig`                    | `updateVoIPChatMuteConfig`           | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `updateWeChatApp`                             | `updateWeChatApp`                    | ✅   | `mapped`   | ✅       | 使用内置 no-op shim（保持调用不抛错）                                  |
| `uploadFile`                                  | `uploadFile`                         | ✅   | `native`   | ✅       | 直连 `my.uploadFile`                                                   |
| `vibrateLong`                                 | `vibrateLong`                        | ✅   | `native`   | ✅       | 直连 `my.vibrateLong`                                                  |
| `vibrateShort`                                | `vibrateShort`                       | ✅   | `native`   | ✅       | 直连 `my.vibrateShort`                                                 |
| `writeBLECharacteristicValue`                 | `writeBLECharacteristicValue`        | ✅   | `native`   | ✅       | 直连 `my.writeBLECharacteristicValue`                                  |
