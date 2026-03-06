# 04 抖音兼容矩阵（按微信命名）

总计：479，支持：149，不支持：330

| 微信 API                                      | 抖音目标 API                                  | 支持 | 策略                                                                              |
| --------------------------------------------- | --------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `addCard`                                     | `addCard`                                     | ❌   | 未提供 tt.addCard，调用时将返回 not supported                                     |
| `addFileToFavorites`                          | `addFileToFavorites`                          | ❌   | 未提供 tt.addFileToFavorites，调用时将返回 not supported                          |
| `addPaymentPassFinish`                        | `addPaymentPassFinish`                        | ❌   | 未提供 tt.addPaymentPassFinish，调用时将返回 not supported                        |
| `addPaymentPassGetCertificateData`            | `addPaymentPassGetCertificateData`            | ❌   | 未提供 tt.addPaymentPassGetCertificateData，调用时将返回 not supported            |
| `addPhoneCalendar`                            | `addPhoneCalendar`                            | ❌   | 未提供 tt.addPhoneCalendar，调用时将返回 not supported                            |
| `addPhoneContact`                             | `addPhoneContact`                             | ❌   | 未提供 tt.addPhoneContact，调用时将返回 not supported                             |
| `addPhoneRepeatCalendar`                      | `addPhoneRepeatCalendar`                      | ❌   | 未提供 tt.addPhoneRepeatCalendar，调用时将返回 not supported                      |
| `addVideoToFavorites`                         | `addVideoToFavorites`                         | ❌   | 未提供 tt.addVideoToFavorites，调用时将返回 not supported                         |
| `arrayBufferToBase64`                         | `arrayBufferToBase64`                         | ✅   | 直连 `tt.arrayBufferToBase64`                                                     |
| `authorize`                                   | `authorize`                                   | ✅   | 直连 `tt.authorize`                                                               |
| `authorizeForMiniProgram`                     | `authorizeForMiniProgram`                     | ❌   | 未提供 tt.authorizeForMiniProgram，调用时将返回 not supported                     |
| `authPrivateMessage`                          | `authPrivateMessage`                          | ❌   | 未提供 tt.authPrivateMessage，调用时将返回 not supported                          |
| `base64ToArrayBuffer`                         | `base64ToArrayBuffer`                         | ✅   | 直连 `tt.base64ToArrayBuffer`                                                     |
| `batchGetStorage`                             | `batchGetStorage`                             | ❌   | 未提供 tt.batchGetStorage，调用时将返回 not supported                             |
| `batchGetStorageSync`                         | `batchGetStorageSync`                         | ❌   | 未提供 tt.batchGetStorageSync，调用时将返回 not supported                         |
| `batchSetStorage`                             | `batchSetStorage`                             | ❌   | 未提供 tt.batchSetStorage，调用时将返回 not supported                             |
| `batchSetStorageSync`                         | `batchSetStorageSync`                         | ❌   | 未提供 tt.batchSetStorageSync，调用时将返回 not supported                         |
| `bindEmployeeRelation`                        | `bindEmployeeRelation`                        | ❌   | 未提供 tt.bindEmployeeRelation，调用时将返回 not supported                        |
| `canAddSecureElementPass`                     | `canAddSecureElementPass`                     | ❌   | 未提供 tt.canAddSecureElementPass，调用时将返回 not supported                     |
| `cancelIdleCallback`                          | `cancelIdleCallback`                          | ❌   | 未提供 tt.cancelIdleCallback，调用时将返回 not supported                          |
| `canIUse`                                     | `canIUse`                                     | ✅   | 直连 `tt.canIUse`                                                                 |
| `canvasGetImageData`                          | `canvasGetImageData`                          | ❌   | 未提供 tt.canvasGetImageData，调用时将返回 not supported                          |
| `canvasPutImageData`                          | `canvasPutImageData`                          | ❌   | 未提供 tt.canvasPutImageData，调用时将返回 not supported                          |
| `canvasToTempFilePath`                        | `canvasToTempFilePath`                        | ✅   | 直连 `tt.canvasToTempFilePath`                                                    |
| `checkDeviceSupportHevc`                      | `checkDeviceSupportHevc`                      | ❌   | 未提供 tt.checkDeviceSupportHevc，调用时将返回 not supported                      |
| `checkEmployeeRelation`                       | `checkEmployeeRelation`                       | ❌   | 未提供 tt.checkEmployeeRelation，调用时将返回 not supported                       |
| `checkIsAddedToMyMiniProgram`                 | `checkIsAddedToMyMiniProgram`                 | ❌   | 未提供 tt.checkIsAddedToMyMiniProgram，调用时将返回 not supported                 |
| `checkIsOpenAccessibility`                    | `checkIsOpenAccessibility`                    | ❌   | 未提供 tt.checkIsOpenAccessibility，调用时将返回 not supported                    |
| `checkIsPictureInPictureActive`               | `checkIsPictureInPictureActive`               | ❌   | 未提供 tt.checkIsPictureInPictureActive，调用时将返回 not supported               |
| `checkIsSoterEnrolledInDevice`                | `checkIsSoterEnrolledInDevice`                | ❌   | 未提供 tt.checkIsSoterEnrolledInDevice，调用时将返回 not supported                |
| `checkIsSupportSoterAuthentication`           | `checkIsSupportSoterAuthentication`           | ❌   | 未提供 tt.checkIsSupportSoterAuthentication，调用时将返回 not supported           |
| `checkSession`                                | `checkSession`                                | ✅   | 直连 `tt.checkSession`                                                            |
| `chooseAddress`                               | `chooseAddress`                               | ✅   | 直连 `tt.chooseAddress`                                                           |
| `chooseContact`                               | `chooseContact`                               | ❌   | 未提供 tt.chooseContact，调用时将返回 not supported                               |
| `chooseImage`                                 | `chooseImage`                                 | ✅   | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底                      |
| `chooseInvoice`                               | `chooseInvoice`                               | ❌   | 未提供 tt.chooseInvoice，调用时将返回 not supported                               |
| `chooseInvoiceTitle`                          | `chooseInvoiceTitle`                          | ❌   | 未提供 tt.chooseInvoiceTitle，调用时将返回 not supported                          |
| `chooseLicensePlate`                          | `chooseLicensePlate`                          | ❌   | 未提供 tt.chooseLicensePlate，调用时将返回 not supported                          |
| `chooseLocation`                              | `chooseLocation`                              | ✅   | 直连 `tt.chooseLocation`                                                          |
| `chooseMedia`                                 | `chooseMedia`                                 | ✅   | 直连 `tt.chooseMedia`                                                             |
| `chooseMessageFile`                           | `chooseMessageFile`                           | ❌   | 未提供 tt.chooseMessageFile，调用时将返回 not supported                           |
| `choosePoi`                                   | `choosePoi`                                   | ❌   | 未提供 tt.choosePoi，调用时将返回 not supported                                   |
| `chooseVideo`                                 | `chooseMedia`                                 | ✅   | 映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构                  |
| `clearStorage`                                | `clearStorage`                                | ✅   | 直连 `tt.clearStorage`                                                            |
| `clearStorageSync`                            | `clearStorageSync`                            | ✅   | 直连 `tt.clearStorageSync`                                                        |
| `closeBLEConnection`                          | `closeBLEConnection`                          | ❌   | 未提供 tt.closeBLEConnection，调用时将返回 not supported                          |
| `closeBluetoothAdapter`                       | `closeBluetoothAdapter`                       | ❌   | 未提供 tt.closeBluetoothAdapter，调用时将返回 not supported                       |
| `closeSocket`                                 | `closeSocket`                                 | ❌   | 未提供 tt.closeSocket，调用时将返回 not supported                                 |
| `compressImage`                               | `compressImage`                               | ✅   | 直连 `tt.compressImage`                                                           |
| `compressVideo`                               | `compressVideo`                               | ❌   | 未提供 tt.compressVideo，调用时将返回 not supported                               |
| `connectSocket`                               | `connectSocket`                               | ✅   | 直连 `tt.connectSocket`                                                           |
| `connectWifi`                                 | `connectWifi`                                 | ❌   | 未提供 tt.connectWifi，调用时将返回 not supported                                 |
| `createAnimation`                             | `createAnimation`                             | ✅   | 直连 `tt.createAnimation`                                                         |
| `createAudioContext`                          | `createInnerAudioContext`                     | ✅   | 映射到 `tt.createInnerAudioContext`                                               |
| `createBLEConnection`                         | `createBLEConnection`                         | ❌   | 未提供 tt.createBLEConnection，调用时将返回 not supported                         |
| `createBLEPeripheralServer`                   | `createBLEPeripheralServer`                   | ❌   | 未提供 tt.createBLEPeripheralServer，调用时将返回 not supported                   |
| `createBufferURL`                             | `createBufferURL`                             | ❌   | 未提供 tt.createBufferURL，调用时将返回 not supported                             |
| `createCacheManager`                          | `createCacheManager`                          | ❌   | 未提供 tt.createCacheManager，调用时将返回 not supported                          |
| `createCameraContext`                         | `createCameraContext`                         | ❌   | 未提供 tt.createCameraContext，调用时将返回 not supported                         |
| `createCanvasContext`                         | `createCanvasContext`                         | ✅   | 直连 `tt.createCanvasContext`                                                     |
| `createGlobalPayment`                         | `createGlobalPayment`                         | ❌   | 未提供 tt.createGlobalPayment，调用时将返回 not supported                         |
| `createInferenceSession`                      | `createInferenceSession`                      | ❌   | 未提供 tt.createInferenceSession，调用时将返回 not supported                      |
| `createInnerAudioContext`                     | `createInnerAudioContext`                     | ✅   | 直连 `tt.createInnerAudioContext`                                                 |
| `createIntersectionObserver`                  | `createIntersectionObserver`                  | ✅   | 直连 `tt.createIntersectionObserver`                                              |
| `createInterstitialAd`                        | `createInterstitialAd`                        | ✅   | 直连 `tt.createInterstitialAd`                                                    |
| `createLivePlayerContext`                     | `createLivePlayerContext`                     | ✅   | 直连 `tt.createLivePlayerContext`                                                 |
| `createLivePusherContext`                     | `createLivePusherContext`                     | ❌   | 未提供 tt.createLivePusherContext，调用时将返回 not supported                     |
| `createMapContext`                            | `createMapContext`                            | ✅   | 直连 `tt.createMapContext`                                                        |
| `createMediaAudioPlayer`                      | `createMediaAudioPlayer`                      | ❌   | 未提供 tt.createMediaAudioPlayer，调用时将返回 not supported                      |
| `createMediaContainer`                        | `createMediaContainer`                        | ❌   | 未提供 tt.createMediaContainer，调用时将返回 not supported                        |
| `createMediaRecorder`                         | `createMediaRecorder`                         | ❌   | 未提供 tt.createMediaRecorder，调用时将返回 not supported                         |
| `createOffscreenCanvas`                       | `createOffscreenCanvas`                       | ✅   | 直连 `tt.createOffscreenCanvas`                                                   |
| `createRewardedVideoAd`                       | `createRewardedVideoAd`                       | ❌   | 未提供 tt.createRewardedVideoAd，调用时将返回 not supported                       |
| `createSelectorQuery`                         | `createSelectorQuery`                         | ✅   | 直连 `tt.createSelectorQuery`                                                     |
| `createTCPSocket`                             | `createTCPSocket`                             | ❌   | 未提供 tt.createTCPSocket，调用时将返回 not supported                             |
| `createUDPSocket`                             | `createUDPSocket`                             | ❌   | 未提供 tt.createUDPSocket，调用时将返回 not supported                             |
| `createVideoContext`                          | `createVideoContext`                          | ✅   | 直连 `tt.createVideoContext`                                                      |
| `createVideoDecoder`                          | `createVideoDecoder`                          | ❌   | 未提供 tt.createVideoDecoder，调用时将返回 not supported                          |
| `createVKSession`                             | `createVKSession`                             | ❌   | 未提供 tt.createVKSession，调用时将返回 not supported                             |
| `createWebAudioContext`                       | `createInnerAudioContext`                     | ✅   | 映射到 `tt.createInnerAudioContext`                                               |
| `createWorker`                                | `createWorker`                                | ✅   | 直连 `tt.createWorker`                                                            |
| `cropImage`                                   | `cropImage`                                   | ❌   | 未提供 tt.cropImage，调用时将返回 not supported                                   |
| `disableAlertBeforeUnload`                    | `disableAlertBeforeUnload`                    | ❌   | 未提供 tt.disableAlertBeforeUnload，调用时将返回 not supported                    |
| `downloadFile`                                | `downloadFile`                                | ✅   | 直连 `tt.downloadFile`                                                            |
| `editImage`                                   | `editImage`                                   | ❌   | 未提供 tt.editImage，调用时将返回 not supported                                   |
| `enableAlertBeforeUnload`                     | `enableAlertBeforeUnload`                     | ❌   | 未提供 tt.enableAlertBeforeUnload，调用时将返回 not supported                     |
| `exitMiniProgram`                             | `exitMiniProgram`                             | ✅   | 直连 `tt.exitMiniProgram`                                                         |
| `exitVoIPChat`                                | `exitVoIPChat`                                | ❌   | 未提供 tt.exitVoIPChat，调用时将返回 not supported                                |
| `faceDetect`                                  | `faceDetect`                                  | ❌   | 未提供 tt.faceDetect，调用时将返回 not supported                                  |
| `getAccountInfoSync`                          | `getEnvInfoSync`                              | ✅   | 映射到 `tt.getEnvInfoSync`，并对齐账号字段结构                                    |
| `getApiCategory`                              | `getApiCategory`                              | ❌   | 未提供 tt.getApiCategory，调用时将返回 not supported                              |
| `getAppAuthorizeSetting`                      | `getSetting`                                  | ✅   | 映射到 `tt.getSetting`                                                            |
| `getAppBaseInfo`                              | `getEnvInfoSync`                              | ✅   | 映射到 `tt.getEnvInfoSync`                                                        |
| `getAvailableAudioSources`                    | `getAvailableAudioSources`                    | ❌   | 未提供 tt.getAvailableAudioSources，调用时将返回 not supported                    |
| `getBackgroundAudioManager`                   | `getBackgroundAudioManager`                   | ✅   | 直连 `tt.getBackgroundAudioManager`                                               |
| `getBackgroundAudioPlayerState`               | `getBackgroundAudioPlayerState`               | ❌   | 未提供 tt.getBackgroundAudioPlayerState，调用时将返回 not supported               |
| `getBackgroundFetchData`                      | `getBackgroundFetchData`                      | ❌   | 未提供 tt.getBackgroundFetchData，调用时将返回 not supported                      |
| `getBackgroundFetchToken`                     | `getBackgroundFetchToken`                     | ❌   | 未提供 tt.getBackgroundFetchToken，调用时将返回 not supported                     |
| `getBatteryInfo`                              | `getBatteryInfo`                              | ❌   | 未提供 tt.getBatteryInfo，调用时将返回 not supported                              |
| `getBatteryInfoSync`                          | `getBatteryInfoSync`                          | ❌   | 未提供 tt.getBatteryInfoSync，调用时将返回 not supported                          |
| `getBeacons`                                  | `getBeacons`                                  | ❌   | 未提供 tt.getBeacons，调用时将返回 not supported                                  |
| `getBLEDeviceCharacteristics`                 | `getBLEDeviceCharacteristics`                 | ❌   | 未提供 tt.getBLEDeviceCharacteristics，调用时将返回 not supported                 |
| `getBLEDeviceRSSI`                            | `getBLEDeviceRSSI`                            | ❌   | 未提供 tt.getBLEDeviceRSSI，调用时将返回 not supported                            |
| `getBLEDeviceServices`                        | `getBLEDeviceServices`                        | ❌   | 未提供 tt.getBLEDeviceServices，调用时将返回 not supported                        |
| `getBLEMTU`                                   | `getBLEMTU`                                   | ❌   | 未提供 tt.getBLEMTU，调用时将返回 not supported                                   |
| `getBluetoothAdapterState`                    | `getBluetoothAdapterState`                    | ❌   | 未提供 tt.getBluetoothAdapterState，调用时将返回 not supported                    |
| `getBluetoothDevices`                         | `getBluetoothDevices`                         | ❌   | 未提供 tt.getBluetoothDevices，调用时将返回 not supported                         |
| `getChannelsLiveInfo`                         | `getChannelsLiveInfo`                         | ❌   | 未提供 tt.getChannelsLiveInfo，调用时将返回 not supported                         |
| `getChannelsLiveNoticeInfo`                   | `getChannelsLiveNoticeInfo`                   | ❌   | 未提供 tt.getChannelsLiveNoticeInfo，调用时将返回 not supported                   |
| `getChannelsShareKey`                         | `getChannelsShareKey`                         | ❌   | 未提供 tt.getChannelsShareKey，调用时将返回 not supported                         |
| `getChatToolInfo`                             | `getChatToolInfo`                             | ❌   | 未提供 tt.getChatToolInfo，调用时将返回 not supported                             |
| `getClipboardData`                            | `getClipboardData`                            | ✅   | 直连 `tt.getClipboardData`                                                        |
| `getCommonConfig`                             | `getCommonConfig`                             | ❌   | 未提供 tt.getCommonConfig，调用时将返回 not supported                             |
| `getConnectedBluetoothDevices`                | `getConnectedBluetoothDevices`                | ❌   | 未提供 tt.getConnectedBluetoothDevices，调用时将返回 not supported                |
| `getConnectedWifi`                            | `getConnectedWifi`                            | ✅   | 直连 `tt.getConnectedWifi`                                                        |
| `getDeviceBenchmarkInfo`                      | `getDeviceBenchmarkInfo`                      | ❌   | 未提供 tt.getDeviceBenchmarkInfo，调用时将返回 not supported                      |
| `getDeviceInfo`                               | `getSystemInfo`                               | ✅   | 映射到 `tt.getSystemInfo`，并提取设备字段                                         |
| `getDeviceVoIPList`                           | `getDeviceVoIPList`                           | ❌   | 未提供 tt.getDeviceVoIPList，调用时将返回 not supported                           |
| `getEnterOptionsSync`                         | `getLaunchOptionsSync`                        | ✅   | 映射到 `tt.getLaunchOptionsSync`                                                  |
| `getExptInfoSync`                             | `getExptInfoSync`                             | ❌   | 未提供 tt.getExptInfoSync，调用时将返回 not supported                             |
| `getExtConfig`                                | `getExtConfig`                                | ✅   | 直连 `tt.getExtConfig`                                                            |
| `getExtConfigSync`                            | `getExtConfigSync`                            | ✅   | 直连 `tt.getExtConfigSync`                                                        |
| `getFileSystemManager`                        | `getFileSystemManager`                        | ✅   | 直连 `tt.getFileSystemManager`                                                    |
| `getFuzzyLocation`                            | `getFuzzyLocation`                            | ❌   | 未提供 tt.getFuzzyLocation，调用时将返回 not supported                            |
| `getGroupEnterInfo`                           | `getGroupEnterInfo`                           | ❌   | 未提供 tt.getGroupEnterInfo，调用时将返回 not supported                           |
| `getHCEState`                                 | `getHCEState`                                 | ❌   | 未提供 tt.getHCEState，调用时将返回 not supported                                 |
| `getImageInfo`                                | `getImageInfo`                                | ✅   | 直连 `tt.getImageInfo`                                                            |
| `getInferenceEnvInfo`                         | `getInferenceEnvInfo`                         | ❌   | 未提供 tt.getInferenceEnvInfo，调用时将返回 not supported                         |
| `getLaunchOptionsSync`                        | `getLaunchOptionsSync`                        | ✅   | 直连 `tt.getLaunchOptionsSync`                                                    |
| `getLocalIPAddress`                           | `getLocalIPAddress`                           | ❌   | 未提供 tt.getLocalIPAddress，调用时将返回 not supported                           |
| `getLocation`                                 | `getLocation`                                 | ✅   | 直连 `tt.getLocation`                                                             |
| `getLogManager`                               | `getLogManager`                               | ❌   | 未提供 tt.getLogManager，调用时将返回 not supported                               |
| `getMenuButtonBoundingClientRect`             | `getMenuButtonBoundingClientRect`             | ✅   | 直连 `tt.getMenuButtonBoundingClientRect`                                         |
| `getNetworkType`                              | `getNetworkType`                              | ❌   | 未提供 tt.getNetworkType，调用时将返回 not supported                              |
| `getNFCAdapter`                               | `getNFCAdapter`                               | ❌   | 未提供 tt.getNFCAdapter，调用时将返回 not supported                               |
| `getPerformance`                              | `getPerformance`                              | ❌   | 未提供 tt.getPerformance，调用时将返回 not supported                              |
| `getPrivacySetting`                           | `getPrivacySetting`                           | ❌   | 未提供 tt.getPrivacySetting，调用时将返回 not supported                           |
| `getRandomValues`                             | `getRandomValues`                             | ❌   | 未提供 tt.getRandomValues，调用时将返回 not supported                             |
| `getRealtimeLogManager`                       | `getRealtimeLogManager`                       | ❌   | 未提供 tt.getRealtimeLogManager，调用时将返回 not supported                       |
| `getRecorderManager`                          | `getRecorderManager`                          | ✅   | 直连 `tt.getRecorderManager`                                                      |
| `getRendererUserAgent`                        | `getRendererUserAgent`                        | ❌   | 未提供 tt.getRendererUserAgent，调用时将返回 not supported                        |
| `getScreenBrightness`                         | `getScreenBrightness`                         | ✅   | 直连 `tt.getScreenBrightness`                                                     |
| `getScreenRecordingState`                     | `getScreenRecordingState`                     | ❌   | 未提供 tt.getScreenRecordingState，调用时将返回 not supported                     |
| `getSecureElementPasses`                      | `getSecureElementPasses`                      | ❌   | 未提供 tt.getSecureElementPasses，调用时将返回 not supported                      |
| `getSelectedTextRange`                        | `getSelectedTextRange`                        | ❌   | 未提供 tt.getSelectedTextRange，调用时将返回 not supported                        |
| `getSetting`                                  | `getSetting`                                  | ✅   | 直连 `tt.getSetting`                                                              |
| `getShareInfo`                                | `getShareInfo`                                | ❌   | 未提供 tt.getShareInfo，调用时将返回 not supported                                |
| `getShowSplashAdStatus`                       | `getShowSplashAdStatus`                       | ❌   | 未提供 tt.getShowSplashAdStatus，调用时将返回 not supported                       |
| `getSkylineInfo`                              | `getSkylineInfo`                              | ❌   | 未提供 tt.getSkylineInfo，调用时将返回 not supported                              |
| `getSkylineInfoSync`                          | `getSkylineInfoSync`                          | ❌   | 未提供 tt.getSkylineInfoSync，调用时将返回 not supported                          |
| `getStorage`                                  | `getStorage`                                  | ✅   | 直连 `tt.getStorage`                                                              |
| `getStorageInfo`                              | `getStorageInfo`                              | ✅   | 直连 `tt.getStorageInfo`                                                          |
| `getStorageInfoSync`                          | `getStorageInfoSync`                          | ✅   | 直连 `tt.getStorageInfoSync`                                                      |
| `getStorageSync`                              | `getStorageSync`                              | ✅   | 直连 `tt.getStorageSync`                                                          |
| `getSystemInfo`                               | `getSystemInfo`                               | ✅   | 直连 `tt.getSystemInfo`                                                           |
| `getSystemInfoAsync`                          | `getSystemInfo`                               | ✅   | 映射到 `tt.getSystemInfo`                                                         |
| `getSystemInfoSync`                           | `getSystemInfoSync`                           | ✅   | 直连 `tt.getSystemInfoSync`                                                       |
| `getSystemSetting`                            | `getSetting`                                  | ✅   | 映射到 `tt.getSetting`                                                            |
| `getUpdateManager`                            | `getUpdateManager`                            | ✅   | 直连 `tt.getUpdateManager`                                                        |
| `getUserCryptoManager`                        | `getUserCryptoManager`                        | ❌   | 未提供 tt.getUserCryptoManager，调用时将返回 not supported                        |
| `getUserInfo`                                 | `getUserInfo`                                 | ✅   | 直连 `tt.getUserInfo`                                                             |
| `getUserProfile`                              | `getUserProfile`                              | ✅   | 直连 `tt.getUserProfile`                                                          |
| `getVideoInfo`                                | `getVideoInfo`                                | ❌   | 未提供 tt.getVideoInfo，调用时将返回 not supported                                |
| `getWeRunData`                                | `getWeRunData`                                | ❌   | 未提供 tt.getWeRunData，调用时将返回 not supported                                |
| `getWifiList`                                 | `getWifiList`                                 | ✅   | 直连 `tt.getWifiList`                                                             |
| `getWindowInfo`                               | `getSystemInfo`                               | ✅   | 映射到 `tt.getSystemInfo`，并提取窗口字段                                         |
| `getXrFrameSystem`                            | `getXrFrameSystem`                            | ❌   | 未提供 tt.getXrFrameSystem，调用时将返回 not supported                            |
| `hideHomeButton`                              | `hideHomeButton`                              | ✅   | 直连 `tt.hideHomeButton`                                                          |
| `hideKeyboard`                                | `hideKeyboard`                                | ✅   | 直连 `tt.hideKeyboard`                                                            |
| `hideLoading`                                 | `hideLoading`                                 | ✅   | 直连 `tt.hideLoading`                                                             |
| `hideNavigationBarLoading`                    | `hideNavigationBarLoading`                    | ✅   | 直连 `tt.hideNavigationBarLoading`                                                |
| `hideShareMenu`                               | `hideShareMenu`                               | ✅   | 直连 `tt.hideShareMenu`                                                           |
| `hideTabBar`                                  | `hideTabBar`                                  | ✅   | 直连 `tt.hideTabBar`                                                              |
| `hideTabBarRedDot`                            | `hideTabBarRedDot`                            | ✅   | 直连 `tt.hideTabBarRedDot`                                                        |
| `hideToast`                                   | `hideToast`                                   | ✅   | 直连 `tt.hideToast`                                                               |
| `initFaceDetect`                              | `initFaceDetect`                              | ❌   | 未提供 tt.initFaceDetect，调用时将返回 not supported                              |
| `isBluetoothDevicePaired`                     | `isBluetoothDevicePaired`                     | ❌   | 未提供 tt.isBluetoothDevicePaired，调用时将返回 not supported                     |
| `isVKSupport`                                 | `isVKSupport`                                 | ❌   | 未提供 tt.isVKSupport，调用时将返回 not supported                                 |
| `join1v1Chat`                                 | `join1v1Chat`                                 | ❌   | 未提供 tt.join1v1Chat，调用时将返回 not supported                                 |
| `joinVoIPChat`                                | `joinVoIPChat`                                | ❌   | 未提供 tt.joinVoIPChat，调用时将返回 not supported                                |
| `loadBuiltInFontFace`                         | `loadBuiltInFontFace`                         | ❌   | 未提供 tt.loadBuiltInFontFace，调用时将返回 not supported                         |
| `loadFontFace`                                | `loadFontFace`                                | ❌   | 未提供 tt.loadFontFace，调用时将返回 not supported                                |
| `login`                                       | `login`                                       | ✅   | 直连 `tt.login`                                                                   |
| `makeBluetoothPair`                           | `makeBluetoothPair`                           | ❌   | 未提供 tt.makeBluetoothPair，调用时将返回 not supported                           |
| `makePhoneCall`                               | `makePhoneCall`                               | ✅   | 直连 `tt.makePhoneCall`                                                           |
| `navigateBack`                                | `navigateBack`                                | ✅   | 直连 `tt.navigateBack`                                                            |
| `navigateBackMiniProgram`                     | `navigateBackMiniProgram`                     | ✅   | 直连 `tt.navigateBackMiniProgram`                                                 |
| `navigateTo`                                  | `navigateTo`                                  | ✅   | 直连 `tt.navigateTo`                                                              |
| `navigateToMiniProgram`                       | `navigateToMiniProgram`                       | ✅   | 直连 `tt.navigateToMiniProgram`                                                   |
| `nextTick`                                    | `nextTick`                                    | ❌   | 未提供 tt.nextTick，调用时将返回 not supported                                    |
| `notifyBLECharacteristicValueChange`          | `notifyBLECharacteristicValueChange`          | ❌   | 未提供 tt.notifyBLECharacteristicValueChange，调用时将返回 not supported          |
| `notifyGroupMembers`                          | `notifyGroupMembers`                          | ❌   | 未提供 tt.notifyGroupMembers，调用时将返回 not supported                          |
| `offAccelerometerChange`                      | `offAccelerometerChange`                      | ❌   | 未提供 tt.offAccelerometerChange，调用时将返回 not supported                      |
| `offAfterPageLoad`                            | `offAfterPageLoad`                            | ❌   | 未提供 tt.offAfterPageLoad，调用时将返回 not supported                            |
| `offAfterPageUnload`                          | `offAfterPageUnload`                          | ❌   | 未提供 tt.offAfterPageUnload，调用时将返回 not supported                          |
| `offApiCategoryChange`                        | `offApiCategoryChange`                        | ❌   | 未提供 tt.offApiCategoryChange，调用时将返回 not supported                        |
| `offAppHide`                                  | `offAppHide`                                  | ✅   | 直连 `tt.offAppHide`                                                              |
| `offAppRoute`                                 | `offAppRoute`                                 | ❌   | 未提供 tt.offAppRoute，调用时将返回 not supported                                 |
| `offAppRouteDone`                             | `offAppRouteDone`                             | ❌   | 未提供 tt.offAppRouteDone，调用时将返回 not supported                             |
| `offAppShow`                                  | `offAppShow`                                  | ✅   | 直连 `tt.offAppShow`                                                              |
| `offAudioInterruptionBegin`                   | `offAudioInterruptionBegin`                   | ❌   | 未提供 tt.offAudioInterruptionBegin，调用时将返回 not supported                   |
| `offAudioInterruptionEnd`                     | `offAudioInterruptionEnd`                     | ❌   | 未提供 tt.offAudioInterruptionEnd，调用时将返回 not supported                     |
| `offBatteryInfoChange`                        | `offBatteryInfoChange`                        | ❌   | 未提供 tt.offBatteryInfoChange，调用时将返回 not supported                        |
| `offBeaconServiceChange`                      | `offBeaconServiceChange`                      | ❌   | 未提供 tt.offBeaconServiceChange，调用时将返回 not supported                      |
| `offBeaconUpdate`                             | `offBeaconUpdate`                             | ❌   | 未提供 tt.offBeaconUpdate，调用时将返回 not supported                             |
| `offBeforeAppRoute`                           | `offBeforeAppRoute`                           | ❌   | 未提供 tt.offBeforeAppRoute，调用时将返回 not supported                           |
| `offBeforePageLoad`                           | `offBeforePageLoad`                           | ❌   | 未提供 tt.offBeforePageLoad，调用时将返回 not supported                           |
| `offBeforePageUnload`                         | `offBeforePageUnload`                         | ❌   | 未提供 tt.offBeforePageUnload，调用时将返回 not supported                         |
| `offBLECharacteristicValueChange`             | `offBLECharacteristicValueChange`             | ❌   | 未提供 tt.offBLECharacteristicValueChange，调用时将返回 not supported             |
| `offBLEConnectionStateChange`                 | `offBLEConnectionStateChange`                 | ❌   | 未提供 tt.offBLEConnectionStateChange，调用时将返回 not supported                 |
| `offBLEMTUChange`                             | `offBLEMTUChange`                             | ❌   | 未提供 tt.offBLEMTUChange，调用时将返回 not supported                             |
| `offBLEPeripheralConnectionStateChanged`      | `offBLEPeripheralConnectionStateChanged`      | ❌   | 未提供 tt.offBLEPeripheralConnectionStateChanged，调用时将返回 not supported      |
| `offBluetoothAdapterStateChange`              | `offBluetoothAdapterStateChange`              | ❌   | 未提供 tt.offBluetoothAdapterStateChange，调用时将返回 not supported              |
| `offBluetoothDeviceFound`                     | `offBluetoothDeviceFound`                     | ❌   | 未提供 tt.offBluetoothDeviceFound，调用时将返回 not supported                     |
| `offCompassChange`                            | `offCompassChange`                            | ✅   | 直连 `tt.offCompassChange`                                                        |
| `offCopyUrl`                                  | `offCopyUrl`                                  | ❌   | 未提供 tt.offCopyUrl，调用时将返回 not supported                                  |
| `offDeviceMotionChange`                       | `offDeviceMotionChange`                       | ❌   | 未提供 tt.offDeviceMotionChange，调用时将返回 not supported                       |
| `offEmbeddedMiniProgramHeightChange`          | `offEmbeddedMiniProgramHeightChange`          | ❌   | 未提供 tt.offEmbeddedMiniProgramHeightChange，调用时将返回 not supported          |
| `offError`                                    | `offError`                                    | ✅   | 直连 `tt.offError`                                                                |
| `offGeneratePoster`                           | `offGeneratePoster`                           | ❌   | 未提供 tt.offGeneratePoster，调用时将返回 not supported                           |
| `offGetWifiList`                              | `offGetWifiList`                              | ✅   | 直连 `tt.offGetWifiList`                                                          |
| `offGyroscopeChange`                          | `offGyroscopeChange`                          | ❌   | 未提供 tt.offGyroscopeChange，调用时将返回 not supported                          |
| `offHCEMessage`                               | `offHCEMessage`                               | ❌   | 未提供 tt.offHCEMessage，调用时将返回 not supported                               |
| `offKeyboardHeightChange`                     | `offKeyboardHeightChange`                     | ❌   | 未提供 tt.offKeyboardHeightChange，调用时将返回 not supported                     |
| `offKeyDown`                                  | `offKeyDown`                                  | ❌   | 未提供 tt.offKeyDown，调用时将返回 not supported                                  |
| `offKeyUp`                                    | `offKeyUp`                                    | ❌   | 未提供 tt.offKeyUp，调用时将返回 not supported                                    |
| `offLazyLoadError`                            | `offLazyLoadError`                            | ✅   | 直连 `tt.offLazyLoadError`                                                        |
| `offLocalServiceDiscoveryStop`                | `offLocalServiceDiscoveryStop`                | ❌   | 未提供 tt.offLocalServiceDiscoveryStop，调用时将返回 not supported                |
| `offLocalServiceFound`                        | `offLocalServiceFound`                        | ❌   | 未提供 tt.offLocalServiceFound，调用时将返回 not supported                        |
| `offLocalServiceLost`                         | `offLocalServiceLost`                         | ❌   | 未提供 tt.offLocalServiceLost，调用时将返回 not supported                         |
| `offLocalServiceResolveFail`                  | `offLocalServiceResolveFail`                  | ❌   | 未提供 tt.offLocalServiceResolveFail，调用时将返回 not supported                  |
| `offLocationChange`                           | `offLocationChange`                           | ❌   | 未提供 tt.offLocationChange，调用时将返回 not supported                           |
| `offLocationChangeError`                      | `offLocationChangeError`                      | ❌   | 未提供 tt.offLocationChangeError，调用时将返回 not supported                      |
| `offMemoryWarning`                            | `offMemoryWarning`                            | ❌   | 未提供 tt.offMemoryWarning，调用时将返回 not supported                            |
| `offMenuButtonBoundingClientRectWeightChange` | `offMenuButtonBoundingClientRectWeightChange` | ❌   | 未提供 tt.offMenuButtonBoundingClientRectWeightChange，调用时将返回 not supported |
| `offNetworkStatusChange`                      | `offNetworkStatusChange`                      | ✅   | 直连 `tt.offNetworkStatusChange`                                                  |
| `offNetworkWeakChange`                        | `offNetworkWeakChange`                        | ❌   | 未提供 tt.offNetworkWeakChange，调用时将返回 not supported                        |
| `offOnUserTriggerTranslation`                 | `offOnUserTriggerTranslation`                 | ❌   | 未提供 tt.offOnUserTriggerTranslation，调用时将返回 not supported                 |
| `offPageNotFound`                             | `offPageNotFound`                             | ✅   | 直连 `tt.offPageNotFound`                                                         |
| `offParallelStateChange`                      | `offParallelStateChange`                      | ❌   | 未提供 tt.offParallelStateChange，调用时将返回 not supported                      |
| `offScreenRecordingStateChanged`              | `offScreenRecordingStateChanged`              | ❌   | 未提供 tt.offScreenRecordingStateChanged，调用时将返回 not supported              |
| `offThemeChange`                              | `offThemeChange`                              | ❌   | 未提供 tt.offThemeChange，调用时将返回 not supported                              |
| `offUnhandledRejection`                       | `offUnhandledRejection`                       | ✅   | 直连 `tt.offUnhandledRejection`                                                   |
| `offUserCaptureScreen`                        | `offUserCaptureScreen`                        | ✅   | 直连 `tt.offUserCaptureScreen`                                                    |
| `offVoIPChatInterrupted`                      | `offVoIPChatInterrupted`                      | ❌   | 未提供 tt.offVoIPChatInterrupted，调用时将返回 not supported                      |
| `offVoIPChatMembersChanged`                   | `offVoIPChatMembersChanged`                   | ❌   | 未提供 tt.offVoIPChatMembersChanged，调用时将返回 not supported                   |
| `offVoIPChatSpeakersChanged`                  | `offVoIPChatSpeakersChanged`                  | ❌   | 未提供 tt.offVoIPChatSpeakersChanged，调用时将返回 not supported                  |
| `offVoIPChatStateChanged`                     | `offVoIPChatStateChanged`                     | ❌   | 未提供 tt.offVoIPChatStateChanged，调用时将返回 not supported                     |
| `offVoIPVideoMembersChanged`                  | `offVoIPVideoMembersChanged`                  | ❌   | 未提供 tt.offVoIPVideoMembersChanged，调用时将返回 not supported                  |
| `offWifiConnected`                            | `offWifiConnected`                            | ❌   | 未提供 tt.offWifiConnected，调用时将返回 not supported                            |
| `offWifiConnectedWithPartialInfo`             | `offWifiConnectedWithPartialInfo`             | ❌   | 未提供 tt.offWifiConnectedWithPartialInfo，调用时将返回 not supported             |
| `offWindowResize`                             | `offWindowResize`                             | ✅   | 直连 `tt.offWindowResize`                                                         |
| `offWindowStateChange`                        | `offWindowStateChange`                        | ❌   | 未提供 tt.offWindowStateChange，调用时将返回 not supported                        |
| `onAccelerometerChange`                       | `onAccelerometerChange`                       | ✅   | 直连 `tt.onAccelerometerChange`                                                   |
| `onAfterPageLoad`                             | `onAfterPageLoad`                             | ❌   | 未提供 tt.onAfterPageLoad，调用时将返回 not supported                             |
| `onAfterPageUnload`                           | `onAfterPageUnload`                           | ❌   | 未提供 tt.onAfterPageUnload，调用时将返回 not supported                           |
| `onApiCategoryChange`                         | `onApiCategoryChange`                         | ❌   | 未提供 tt.onApiCategoryChange，调用时将返回 not supported                         |
| `onAppHide`                                   | `onAppHide`                                   | ✅   | 直连 `tt.onAppHide`                                                               |
| `onAppRoute`                                  | `onAppRoute`                                  | ❌   | 未提供 tt.onAppRoute，调用时将返回 not supported                                  |
| `onAppRouteDone`                              | `onAppRouteDone`                              | ❌   | 未提供 tt.onAppRouteDone，调用时将返回 not supported                              |
| `onAppShow`                                   | `onAppShow`                                   | ✅   | 直连 `tt.onAppShow`                                                               |
| `onAudioInterruptionBegin`                    | `onAudioInterruptionBegin`                    | ❌   | 未提供 tt.onAudioInterruptionBegin，调用时将返回 not supported                    |
| `onAudioInterruptionEnd`                      | `onAudioInterruptionEnd`                      | ❌   | 未提供 tt.onAudioInterruptionEnd，调用时将返回 not supported                      |
| `onBackgroundAudioPause`                      | `onBackgroundAudioPause`                      | ❌   | 未提供 tt.onBackgroundAudioPause，调用时将返回 not supported                      |
| `onBackgroundAudioPlay`                       | `onBackgroundAudioPlay`                       | ❌   | 未提供 tt.onBackgroundAudioPlay，调用时将返回 not supported                       |
| `onBackgroundAudioStop`                       | `onBackgroundAudioStop`                       | ❌   | 未提供 tt.onBackgroundAudioStop，调用时将返回 not supported                       |
| `onBackgroundFetchData`                       | `onBackgroundFetchData`                       | ❌   | 未提供 tt.onBackgroundFetchData，调用时将返回 not supported                       |
| `onBatteryInfoChange`                         | `onBatteryInfoChange`                         | ❌   | 未提供 tt.onBatteryInfoChange，调用时将返回 not supported                         |
| `onBeaconServiceChange`                       | `onBeaconServiceChange`                       | ❌   | 未提供 tt.onBeaconServiceChange，调用时将返回 not supported                       |
| `onBeaconUpdate`                              | `onBeaconUpdate`                              | ❌   | 未提供 tt.onBeaconUpdate，调用时将返回 not supported                              |
| `onBeforeAppRoute`                            | `onBeforeAppRoute`                            | ❌   | 未提供 tt.onBeforeAppRoute，调用时将返回 not supported                            |
| `onBeforePageLoad`                            | `onBeforePageLoad`                            | ❌   | 未提供 tt.onBeforePageLoad，调用时将返回 not supported                            |
| `onBeforePageUnload`                          | `onBeforePageUnload`                          | ❌   | 未提供 tt.onBeforePageUnload，调用时将返回 not supported                          |
| `onBLECharacteristicValueChange`              | `onBLECharacteristicValueChange`              | ❌   | 未提供 tt.onBLECharacteristicValueChange，调用时将返回 not supported              |
| `onBLEConnectionStateChange`                  | `onBLEConnectionStateChange`                  | ❌   | 未提供 tt.onBLEConnectionStateChange，调用时将返回 not supported                  |
| `onBLEMTUChange`                              | `onBLEMTUChange`                              | ❌   | 未提供 tt.onBLEMTUChange，调用时将返回 not supported                              |
| `onBLEPeripheralConnectionStateChanged`       | `onBLEPeripheralConnectionStateChanged`       | ❌   | 未提供 tt.onBLEPeripheralConnectionStateChanged，调用时将返回 not supported       |
| `onBluetoothAdapterStateChange`               | `onBluetoothAdapterStateChange`               | ❌   | 未提供 tt.onBluetoothAdapterStateChange，调用时将返回 not supported               |
| `onBluetoothDeviceFound`                      | `onBluetoothDeviceFound`                      | ❌   | 未提供 tt.onBluetoothDeviceFound，调用时将返回 not supported                      |
| `onCompassChange`                             | `onCompassChange`                             | ✅   | 直连 `tt.onCompassChange`                                                         |
| `onCopyUrl`                                   | `onCopyUrl`                                   | ❌   | 未提供 tt.onCopyUrl，调用时将返回 not supported                                   |
| `onDeviceMotionChange`                        | `onDeviceMotionChange`                        | ❌   | 未提供 tt.onDeviceMotionChange，调用时将返回 not supported                        |
| `onEmbeddedMiniProgramHeightChange`           | `onEmbeddedMiniProgramHeightChange`           | ❌   | 未提供 tt.onEmbeddedMiniProgramHeightChange，调用时将返回 not supported           |
| `onError`                                     | `onError`                                     | ✅   | 直连 `tt.onError`                                                                 |
| `onGeneratePoster`                            | `onGeneratePoster`                            | ❌   | 未提供 tt.onGeneratePoster，调用时将返回 not supported                            |
| `onGetWifiList`                               | `onGetWifiList`                               | ✅   | 直连 `tt.onGetWifiList`                                                           |
| `onGyroscopeChange`                           | `onGyroscopeChange`                           | ❌   | 未提供 tt.onGyroscopeChange，调用时将返回 not supported                           |
| `onHCEMessage`                                | `onHCEMessage`                                | ❌   | 未提供 tt.onHCEMessage，调用时将返回 not supported                                |
| `onKeyboardHeightChange`                      | `onKeyboardHeightChange`                      | ❌   | 未提供 tt.onKeyboardHeightChange，调用时将返回 not supported                      |
| `onKeyDown`                                   | `onKeyDown`                                   | ❌   | 未提供 tt.onKeyDown，调用时将返回 not supported                                   |
| `onKeyUp`                                     | `onKeyUp`                                     | ❌   | 未提供 tt.onKeyUp，调用时将返回 not supported                                     |
| `onLazyLoadError`                             | `onLazyLoadError`                             | ✅   | 直连 `tt.onLazyLoadError`                                                         |
| `onLocalServiceDiscoveryStop`                 | `onLocalServiceDiscoveryStop`                 | ❌   | 未提供 tt.onLocalServiceDiscoveryStop，调用时将返回 not supported                 |
| `onLocalServiceFound`                         | `onLocalServiceFound`                         | ❌   | 未提供 tt.onLocalServiceFound，调用时将返回 not supported                         |
| `onLocalServiceLost`                          | `onLocalServiceLost`                          | ❌   | 未提供 tt.onLocalServiceLost，调用时将返回 not supported                          |
| `onLocalServiceResolveFail`                   | `onLocalServiceResolveFail`                   | ❌   | 未提供 tt.onLocalServiceResolveFail，调用时将返回 not supported                   |
| `onLocationChange`                            | `onLocationChange`                            | ❌   | 未提供 tt.onLocationChange，调用时将返回 not supported                            |
| `onLocationChangeError`                       | `onLocationChangeError`                       | ❌   | 未提供 tt.onLocationChangeError，调用时将返回 not supported                       |
| `onMemoryWarning`                             | `onMemoryWarning`                             | ✅   | 直连 `tt.onMemoryWarning`                                                         |
| `onMenuButtonBoundingClientRectWeightChange`  | `onMenuButtonBoundingClientRectWeightChange`  | ❌   | 未提供 tt.onMenuButtonBoundingClientRectWeightChange，调用时将返回 not supported  |
| `onNeedPrivacyAuthorization`                  | `onNeedPrivacyAuthorization`                  | ❌   | 未提供 tt.onNeedPrivacyAuthorization，调用时将返回 not supported                  |
| `onNetworkStatusChange`                       | `onNetworkStatusChange`                       | ✅   | 直连 `tt.onNetworkStatusChange`                                                   |
| `onNetworkWeakChange`                         | `onNetworkWeakChange`                         | ❌   | 未提供 tt.onNetworkWeakChange，调用时将返回 not supported                         |
| `onOnUserTriggerTranslation`                  | `onOnUserTriggerTranslation`                  | ❌   | 未提供 tt.onOnUserTriggerTranslation，调用时将返回 not supported                  |
| `onPageNotFound`                              | `onPageNotFound`                              | ✅   | 直连 `tt.onPageNotFound`                                                          |
| `onParallelStateChange`                       | `onParallelStateChange`                       | ❌   | 未提供 tt.onParallelStateChange，调用时将返回 not supported                       |
| `onScreenRecordingStateChanged`               | `onScreenRecordingStateChanged`               | ❌   | 未提供 tt.onScreenRecordingStateChanged，调用时将返回 not supported               |
| `onSocketClose`                               | `onSocketClose`                               | ❌   | 未提供 tt.onSocketClose，调用时将返回 not supported                               |
| `onSocketError`                               | `onSocketError`                               | ❌   | 未提供 tt.onSocketError，调用时将返回 not supported                               |
| `onSocketMessage`                             | `onSocketMessage`                             | ❌   | 未提供 tt.onSocketMessage，调用时将返回 not supported                             |
| `onSocketOpen`                                | `onSocketOpen`                                | ❌   | 未提供 tt.onSocketOpen，调用时将返回 not supported                                |
| `onThemeChange`                               | `onThemeChange`                               | ❌   | 未提供 tt.onThemeChange，调用时将返回 not supported                               |
| `onUnhandledRejection`                        | `onUnhandledRejection`                        | ✅   | 直连 `tt.onUnhandledRejection`                                                    |
| `onUserCaptureScreen`                         | `onUserCaptureScreen`                         | ✅   | 直连 `tt.onUserCaptureScreen`                                                     |
| `onVoIPChatInterrupted`                       | `onVoIPChatInterrupted`                       | ❌   | 未提供 tt.onVoIPChatInterrupted，调用时将返回 not supported                       |
| `onVoIPChatMembersChanged`                    | `onVoIPChatMembersChanged`                    | ❌   | 未提供 tt.onVoIPChatMembersChanged，调用时将返回 not supported                    |
| `onVoIPChatSpeakersChanged`                   | `onVoIPChatSpeakersChanged`                   | ❌   | 未提供 tt.onVoIPChatSpeakersChanged，调用时将返回 not supported                   |
| `onVoIPChatStateChanged`                      | `onVoIPChatStateChanged`                      | ❌   | 未提供 tt.onVoIPChatStateChanged，调用时将返回 not supported                      |
| `onVoIPVideoMembersChanged`                   | `onVoIPVideoMembersChanged`                   | ❌   | 未提供 tt.onVoIPVideoMembersChanged，调用时将返回 not supported                   |
| `onWifiConnected`                             | `onWifiConnected`                             | ❌   | 未提供 tt.onWifiConnected，调用时将返回 not supported                             |
| `onWifiConnectedWithPartialInfo`              | `onWifiConnectedWithPartialInfo`              | ❌   | 未提供 tt.onWifiConnectedWithPartialInfo，调用时将返回 not supported              |
| `onWindowResize`                              | `onWindowResize`                              | ✅   | 直连 `tt.onWindowResize`                                                          |
| `onWindowStateChange`                         | `onWindowStateChange`                         | ❌   | 未提供 tt.onWindowStateChange，调用时将返回 not supported                         |
| `openAppAuthorizeSetting`                     | `openSetting`                                 | ✅   | 映射到 `tt.openSetting`                                                           |
| `openBluetoothAdapter`                        | `openBluetoothAdapter`                        | ❌   | 未提供 tt.openBluetoothAdapter，调用时将返回 not supported                        |
| `openCard`                                    | `openCard`                                    | ❌   | 未提供 tt.openCard，调用时将返回 not supported                                    |
| `openChannelsActivity`                        | `openChannelsActivity`                        | ❌   | 未提供 tt.openChannelsActivity，调用时将返回 not supported                        |
| `openChannelsEvent`                           | `openChannelsEvent`                           | ❌   | 未提供 tt.openChannelsEvent，调用时将返回 not supported                           |
| `openChannelsLive`                            | `openChannelsLive`                            | ❌   | 未提供 tt.openChannelsLive，调用时将返回 not supported                            |
| `openChannelsLiveNoticeInfo`                  | `openChannelsLiveNoticeInfo`                  | ❌   | 未提供 tt.openChannelsLiveNoticeInfo，调用时将返回 not supported                  |
| `openChannelsUserProfile`                     | `openChannelsUserProfile`                     | ❌   | 未提供 tt.openChannelsUserProfile，调用时将返回 not supported                     |
| `openChatTool`                                | `openChatTool`                                | ❌   | 未提供 tt.openChatTool，调用时将返回 not supported                                |
| `openCustomerServiceChat`                     | `openCustomerServiceChat`                     | ❌   | 未提供 tt.openCustomerServiceChat，调用时将返回 not supported                     |
| `openDocument`                                | `openDocument`                                | ❌   | 未提供 tt.openDocument，调用时将返回 not supported                                |
| `openEmbeddedMiniProgram`                     | `navigateToMiniProgram`                       | ✅   | 映射到 `tt.navigateToMiniProgram`                                                 |
| `openHKOfflinePayView`                        | `openHKOfflinePayView`                        | ❌   | 未提供 tt.openHKOfflinePayView，调用时将返回 not supported                        |
| `openInquiriesTopic`                          | `openInquiriesTopic`                          | ❌   | 未提供 tt.openInquiriesTopic，调用时将返回 not supported                          |
| `openLocation`                                | `openLocation`                                | ✅   | 直连 `tt.openLocation`                                                            |
| `openOfficialAccountArticle`                  | `openOfficialAccountArticle`                  | ❌   | 未提供 tt.openOfficialAccountArticle，调用时将返回 not supported                  |
| `openOfficialAccountChat`                     | `openOfficialAccountChat`                     | ❌   | 未提供 tt.openOfficialAccountChat，调用时将返回 not supported                     |
| `openOfficialAccountProfile`                  | `openOfficialAccountProfile`                  | ❌   | 未提供 tt.openOfficialAccountProfile，调用时将返回 not supported                  |
| `openPrivacyContract`                         | `openPrivacyContract`                         | ❌   | 未提供 tt.openPrivacyContract，调用时将返回 not supported                         |
| `openSetting`                                 | `openSetting`                                 | ✅   | 直连 `tt.openSetting`                                                             |
| `openSingleStickerView`                       | `openSingleStickerView`                       | ❌   | 未提供 tt.openSingleStickerView，调用时将返回 not supported                       |
| `openStickerIPView`                           | `openStickerIPView`                           | ❌   | 未提供 tt.openStickerIPView，调用时将返回 not supported                           |
| `openStickerSetView`                          | `openStickerSetView`                          | ❌   | 未提供 tt.openStickerSetView，调用时将返回 not supported                          |
| `openStoreCouponDetail`                       | `openStoreCouponDetail`                       | ❌   | 未提供 tt.openStoreCouponDetail，调用时将返回 not supported                       |
| `openStoreOrderDetail`                        | `openStoreOrderDetail`                        | ❌   | 未提供 tt.openStoreOrderDetail，调用时将返回 not supported                        |
| `openSystemBluetoothSetting`                  | `openSystemBluetoothSetting`                  | ❌   | 未提供 tt.openSystemBluetoothSetting，调用时将返回 not supported                  |
| `openVideoEditor`                             | `openVideoEditor`                             | ❌   | 未提供 tt.openVideoEditor，调用时将返回 not supported                             |
| `pageScrollTo`                                | `pageScrollTo`                                | ✅   | 直连 `tt.pageScrollTo`                                                            |
| `pauseBackgroundAudio`                        | `pauseBackgroundAudio`                        | ❌   | 未提供 tt.pauseBackgroundAudio，调用时将返回 not supported                        |
| `pauseVoice`                                  | `pauseVoice`                                  | ❌   | 未提供 tt.pauseVoice，调用时将返回 not supported                                  |
| `playBackgroundAudio`                         | `playBackgroundAudio`                         | ❌   | 未提供 tt.playBackgroundAudio，调用时将返回 not supported                         |
| `playVoice`                                   | `playVoice`                                   | ❌   | 未提供 tt.playVoice，调用时将返回 not supported                                   |
| `pluginLogin`                                 | `login`                                       | ✅   | 映射到 `tt.login`                                                                 |
| `postMessageToReferrerMiniProgram`            | `postMessageToReferrerMiniProgram`            | ❌   | 未提供 tt.postMessageToReferrerMiniProgram，调用时将返回 not supported            |
| `postMessageToReferrerPage`                   | `postMessageToReferrerPage`                   | ❌   | 未提供 tt.postMessageToReferrerPage，调用时将返回 not supported                   |
| `preDownloadSubpackage`                       | `preDownloadSubpackage`                       | ❌   | 未提供 tt.preDownloadSubpackage，调用时将返回 not supported                       |
| `preloadAssets`                               | `preloadAssets`                               | ❌   | 未提供 tt.preloadAssets，调用时将返回 not supported                               |
| `preloadSkylineView`                          | `preloadSkylineView`                          | ❌   | 未提供 tt.preloadSkylineView，调用时将返回 not supported                          |
| `preloadWebview`                              | `preloadWebview`                              | ❌   | 未提供 tt.preloadWebview，调用时将返回 not supported                              |
| `previewImage`                                | `previewImage`                                | ✅   | 直连 `tt.previewImage`                                                            |
| `previewMedia`                                | `previewMedia`                                | ❌   | 未提供 tt.previewMedia，调用时将返回 not supported                                |
| `readBLECharacteristicValue`                  | `readBLECharacteristicValue`                  | ❌   | 未提供 tt.readBLECharacteristicValue，调用时将返回 not supported                  |
| `redirectTo`                                  | `redirectTo`                                  | ✅   | 直连 `tt.redirectTo`                                                              |
| `reLaunch`                                    | `reLaunch`                                    | ✅   | 直连 `tt.reLaunch`                                                                |
| `removeSecureElementPass`                     | `removeSecureElementPass`                     | ❌   | 未提供 tt.removeSecureElementPass，调用时将返回 not supported                     |
| `removeStorage`                               | `removeStorage`                               | ✅   | 直连 `tt.removeStorage`                                                           |
| `removeStorageSync`                           | `removeStorageSync`                           | ✅   | 直连 `tt.removeStorageSync`                                                       |
| `removeTabBarBadge`                           | `removeTabBarBadge`                           | ✅   | 直连 `tt.removeTabBarBadge`                                                       |
| `reportAnalytics`                             | `reportAnalytics`                             | ✅   | 直连 `tt.reportAnalytics`                                                         |
| `reportEvent`                                 | `reportEvent`                                 | ❌   | 未提供 tt.reportEvent，调用时将返回 not supported                                 |
| `reportMonitor`                               | `reportMonitor`                               | ❌   | 未提供 tt.reportMonitor，调用时将返回 not supported                               |
| `reportPerformance`                           | `reportPerformance`                           | ❌   | 未提供 tt.reportPerformance，调用时将返回 not supported                           |
| `request`                                     | `request`                                     | ✅   | 直连 `tt.request`                                                                 |
| `requestCommonPayment`                        | `requestCommonPayment`                        | ❌   | 未提供 tt.requestCommonPayment，调用时将返回 not supported                        |
| `requestDeviceVoIP`                           | `requestDeviceVoIP`                           | ❌   | 未提供 tt.requestDeviceVoIP，调用时将返回 not supported                           |
| `requestIdleCallback`                         | `requestIdleCallback`                         | ❌   | 未提供 tt.requestIdleCallback，调用时将返回 not supported                         |
| `requestMerchantTransfer`                     | `requestMerchantTransfer`                     | ❌   | 未提供 tt.requestMerchantTransfer，调用时将返回 not supported                     |
| `requestOrderPayment`                         | `requestOrderPayment`                         | ❌   | 未提供 tt.requestOrderPayment，调用时将返回 not supported                         |
| `requestPayment`                              | `requestPayment`                              | ❌   | 未提供 tt.requestPayment，调用时将返回 not supported                              |
| `requestPluginPayment`                        | `requestPluginPayment`                        | ❌   | 未提供 tt.requestPluginPayment，调用时将返回 not supported                        |
| `requestSubscribeDeviceMessage`               | `requestSubscribeMessage`                     | ✅   | 映射到 `tt.requestSubscribeMessage`                                               |
| `requestSubscribeEmployeeMessage`             | `requestSubscribeMessage`                     | ✅   | 映射到 `tt.requestSubscribeMessage`                                               |
| `requestSubscribeMessage`                     | `requestSubscribeMessage`                     | ✅   | 直连 `tt.requestSubscribeMessage`                                                 |
| `requestVirtualPayment`                       | `requestVirtualPayment`                       | ❌   | 未提供 tt.requestVirtualPayment，调用时将返回 not supported                       |
| `requirePrivacyAuthorize`                     | `requirePrivacyAuthorize`                     | ❌   | 未提供 tt.requirePrivacyAuthorize，调用时将返回 not supported                     |
| `reserveChannelsLive`                         | `reserveChannelsLive`                         | ❌   | 未提供 tt.reserveChannelsLive，调用时将返回 not supported                         |
| `restartMiniProgram`                          | `reLaunch`                                    | ✅   | 映射到 `tt.reLaunch`                                                              |
| `revokeBufferURL`                             | `revokeBufferURL`                             | ❌   | 未提供 tt.revokeBufferURL，调用时将返回 not supported                             |
| `rewriteRoute`                                | `rewriteRoute`                                | ❌   | 未提供 tt.rewriteRoute，调用时将返回 not supported                                |
| `saveFileToDisk`                              | `saveFile`                                    | ✅   | 映射到 `tt.saveFile`                                                              |
| `saveImageToPhotosAlbum`                      | `saveImageToPhotosAlbum`                      | ✅   | 直连 `tt.saveImageToPhotosAlbum`                                                  |
| `saveVideoToPhotosAlbum`                      | `saveVideoToPhotosAlbum`                      | ❌   | 未提供 tt.saveVideoToPhotosAlbum，调用时将返回 not supported                      |
| `scanCode`                                    | `scanCode`                                    | ✅   | 直连 `tt.scanCode`                                                                |
| `seekBackgroundAudio`                         | `seekBackgroundAudio`                         | ❌   | 未提供 tt.seekBackgroundAudio，调用时将返回 not supported                         |
| `selectGroupMembers`                          | `selectGroupMembers`                          | ❌   | 未提供 tt.selectGroupMembers，调用时将返回 not supported                          |
| `sendHCEMessage`                              | `sendHCEMessage`                              | ❌   | 未提供 tt.sendHCEMessage，调用时将返回 not supported                              |
| `sendSms`                                     | `sendSms`                                     | ❌   | 未提供 tt.sendSms，调用时将返回 not supported                                     |
| `sendSocketMessage`                           | `sendSocketMessage`                           | ❌   | 未提供 tt.sendSocketMessage，调用时将返回 not supported                           |
| `setBackgroundColor`                          | `setBackgroundColor`                          | ❌   | 未提供 tt.setBackgroundColor，调用时将返回 not supported                          |
| `setBackgroundFetchToken`                     | `setBackgroundFetchToken`                     | ❌   | 未提供 tt.setBackgroundFetchToken，调用时将返回 not supported                     |
| `setBackgroundTextStyle`                      | `setBackgroundTextStyle`                      | ❌   | 未提供 tt.setBackgroundTextStyle，调用时将返回 not supported                      |
| `setBLEMTU`                                   | `setBLEMTU`                                   | ❌   | 未提供 tt.setBLEMTU，调用时将返回 not supported                                   |
| `setClipboardData`                            | `setClipboardData`                            | ✅   | 直连 `tt.setClipboardData`                                                        |
| `setEnable1v1Chat`                            | `setEnable1v1Chat`                            | ❌   | 未提供 tt.setEnable1v1Chat，调用时将返回 not supported                            |
| `setEnableDebug`                              | `setEnableDebug`                              | ❌   | 未提供 tt.setEnableDebug，调用时将返回 not supported                              |
| `setInnerAudioOption`                         | `setInnerAudioOption`                         | ❌   | 未提供 tt.setInnerAudioOption，调用时将返回 not supported                         |
| `setKeepScreenOn`                             | `setKeepScreenOn`                             | ✅   | 直连 `tt.setKeepScreenOn`                                                         |
| `setNavigationBarColor`                       | `setNavigationBarColor`                       | ✅   | 直连 `tt.setNavigationBarColor`                                                   |
| `setNavigationBarTitle`                       | `setNavigationBarTitle`                       | ✅   | 直连 `tt.setNavigationBarTitle`                                                   |
| `setScreenBrightness`                         | `setScreenBrightness`                         | ✅   | 直连 `tt.setScreenBrightness`                                                     |
| `setStorage`                                  | `setStorage`                                  | ✅   | 直连 `tt.setStorage`                                                              |
| `setStorageSync`                              | `setStorageSync`                              | ✅   | 直连 `tt.setStorageSync`                                                          |
| `setTabBarBadge`                              | `setTabBarBadge`                              | ✅   | 直连 `tt.setTabBarBadge`                                                          |
| `setTabBarItem`                               | `setTabBarItem`                               | ✅   | 直连 `tt.setTabBarItem`                                                           |
| `setTabBarStyle`                              | `setTabBarStyle`                              | ✅   | 直连 `tt.setTabBarStyle`                                                          |
| `setTopBarText`                               | `setTopBarText`                               | ❌   | 未提供 tt.setTopBarText，调用时将返回 not supported                               |
| `setVisualEffectOnCapture`                    | `setVisualEffectOnCapture`                    | ❌   | 未提供 tt.setVisualEffectOnCapture，调用时将返回 not supported                    |
| `setWifiList`                                 | `setWifiList`                                 | ❌   | 未提供 tt.setWifiList，调用时将返回 not supported                                 |
| `setWindowSize`                               | `setWindowSize`                               | ❌   | 未提供 tt.setWindowSize，调用时将返回 not supported                               |
| `shareAppMessageToGroup`                      | `shareAppMessageToGroup`                      | ❌   | 未提供 tt.shareAppMessageToGroup，调用时将返回 not supported                      |
| `shareEmojiToGroup`                           | `shareEmojiToGroup`                           | ❌   | 未提供 tt.shareEmojiToGroup，调用时将返回 not supported                           |
| `shareFileMessage`                            | `shareFileMessage`                            | ❌   | 未提供 tt.shareFileMessage，调用时将返回 not supported                            |
| `shareFileToGroup`                            | `shareFileToGroup`                            | ❌   | 未提供 tt.shareFileToGroup，调用时将返回 not supported                            |
| `shareImageToGroup`                           | `shareImageToGroup`                           | ❌   | 未提供 tt.shareImageToGroup，调用时将返回 not supported                           |
| `shareToOfficialAccount`                      | `shareToOfficialAccount`                      | ❌   | 未提供 tt.shareToOfficialAccount，调用时将返回 not supported                      |
| `shareToWeRun`                                | `shareToWeRun`                                | ❌   | 未提供 tt.shareToWeRun，调用时将返回 not supported                                |
| `shareVideoMessage`                           | `shareVideoMessage`                           | ❌   | 未提供 tt.shareVideoMessage，调用时将返回 not supported                           |
| `shareVideoToGroup`                           | `shareVideoToGroup`                           | ❌   | 未提供 tt.shareVideoToGroup，调用时将返回 not supported                           |
| `showActionSheet`                             | `showActionSheet`                             | ❌   | 直连 `tt.showActionSheet`，并兼容 `index` → `tapIndex`                            |
| `showLoading`                                 | `showLoading`                                 | ✅   | 直连 `tt.showLoading`                                                             |
| `showModal`                                   | `showModal`                                   | ✅   | 直连 `tt.showModal`                                                               |
| `showNavigationBarLoading`                    | `showNavigationBarLoading`                    | ✅   | 直连 `tt.showNavigationBarLoading`                                                |
| `showRedPackage`                              | `showRedPackage`                              | ❌   | 未提供 tt.showRedPackage，调用时将返回 not supported                              |
| `showShareImageMenu`                          | `showShareMenu`                               | ✅   | 映射到 `tt.showShareMenu`                                                         |
| `showShareMenu`                               | `showShareMenu`                               | ✅   | 直连 `tt.showShareMenu`                                                           |
| `showTabBar`                                  | `showTabBar`                                  | ✅   | 直连 `tt.showTabBar`                                                              |
| `showTabBarRedDot`                            | `showTabBarRedDot`                            | ✅   | 直连 `tt.showTabBarRedDot`                                                        |
| `showToast`                                   | `showToast`                                   | ✅   | `icon=error` 映射为 `fail` 后调用 `tt.showToast`                                  |
| `startAccelerometer`                          | `startAccelerometer`                          | ✅   | 直连 `tt.startAccelerometer`                                                      |
| `startBeaconDiscovery`                        | `startBeaconDiscovery`                        | ❌   | 未提供 tt.startBeaconDiscovery，调用时将返回 not supported                        |
| `startBluetoothDevicesDiscovery`              | `startBluetoothDevicesDiscovery`              | ❌   | 未提供 tt.startBluetoothDevicesDiscovery，调用时将返回 not supported              |
| `startCompass`                                | `startCompass`                                | ✅   | 直连 `tt.startCompass`                                                            |
| `startDeviceMotionListening`                  | `startDeviceMotionListening`                  | ❌   | 未提供 tt.startDeviceMotionListening，调用时将返回 not supported                  |
| `startGyroscope`                              | `startGyroscope`                              | ❌   | 未提供 tt.startGyroscope，调用时将返回 not supported                              |
| `startHCE`                                    | `startHCE`                                    | ❌   | 未提供 tt.startHCE，调用时将返回 not supported                                    |
| `startLocalServiceDiscovery`                  | `startLocalServiceDiscovery`                  | ❌   | 未提供 tt.startLocalServiceDiscovery，调用时将返回 not supported                  |
| `startLocationUpdate`                         | `startLocationUpdate`                         | ❌   | 未提供 tt.startLocationUpdate，调用时将返回 not supported                         |
| `startLocationUpdateBackground`               | `startLocationUpdateBackground`               | ❌   | 未提供 tt.startLocationUpdateBackground，调用时将返回 not supported               |
| `startPullDownRefresh`                        | `startPullDownRefresh`                        | ✅   | 直连 `tt.startPullDownRefresh`                                                    |
| `startRecord`                                 | `startRecord`                                 | ❌   | 未提供 tt.startRecord，调用时将返回 not supported                                 |
| `startSoterAuthentication`                    | `startSoterAuthentication`                    | ❌   | 未提供 tt.startSoterAuthentication，调用时将返回 not supported                    |
| `startWifi`                                   | `startWifi`                                   | ❌   | 未提供 tt.startWifi，调用时将返回 not supported                                   |
| `stopAccelerometer`                           | `stopAccelerometer`                           | ✅   | 直连 `tt.stopAccelerometer`                                                       |
| `stopBackgroundAudio`                         | `stopBackgroundAudio`                         | ❌   | 未提供 tt.stopBackgroundAudio，调用时将返回 not supported                         |
| `stopBeaconDiscovery`                         | `stopBeaconDiscovery`                         | ❌   | 未提供 tt.stopBeaconDiscovery，调用时将返回 not supported                         |
| `stopBluetoothDevicesDiscovery`               | `stopBluetoothDevicesDiscovery`               | ❌   | 未提供 tt.stopBluetoothDevicesDiscovery，调用时将返回 not supported               |
| `stopCompass`                                 | `stopCompass`                                 | ✅   | 直连 `tt.stopCompass`                                                             |
| `stopDeviceMotionListening`                   | `stopDeviceMotionListening`                   | ❌   | 未提供 tt.stopDeviceMotionListening，调用时将返回 not supported                   |
| `stopFaceDetect`                              | `stopFaceDetect`                              | ❌   | 未提供 tt.stopFaceDetect，调用时将返回 not supported                              |
| `stopGyroscope`                               | `stopGyroscope`                               | ❌   | 未提供 tt.stopGyroscope，调用时将返回 not supported                               |
| `stopHCE`                                     | `stopHCE`                                     | ❌   | 未提供 tt.stopHCE，调用时将返回 not supported                                     |
| `stopLocalServiceDiscovery`                   | `stopLocalServiceDiscovery`                   | ❌   | 未提供 tt.stopLocalServiceDiscovery，调用时将返回 not supported                   |
| `stopLocationUpdate`                          | `stopLocationUpdate`                          | ❌   | 未提供 tt.stopLocationUpdate，调用时将返回 not supported                          |
| `stopPullDownRefresh`                         | `stopPullDownRefresh`                         | ✅   | 直连 `tt.stopPullDownRefresh`                                                     |
| `stopRecord`                                  | `stopRecord`                                  | ❌   | 未提供 tt.stopRecord，调用时将返回 not supported                                  |
| `stopVoice`                                   | `stopVoice`                                   | ❌   | 未提供 tt.stopVoice，调用时将返回 not supported                                   |
| `stopWifi`                                    | `stopWifi`                                    | ❌   | 未提供 tt.stopWifi，调用时将返回 not supported                                    |
| `subscribeVoIPVideoMembers`                   | `subscribeVoIPVideoMembers`                   | ❌   | 未提供 tt.subscribeVoIPVideoMembers，调用时将返回 not supported                   |
| `switchTab`                                   | `switchTab`                                   | ✅   | 直连 `tt.switchTab`                                                               |
| `updateShareMenu`                             | `showShareMenu`                               | ✅   | 映射到 `tt.showShareMenu`                                                         |
| `updateVoIPChatMuteConfig`                    | `updateVoIPChatMuteConfig`                    | ❌   | 未提供 tt.updateVoIPChatMuteConfig，调用时将返回 not supported                    |
| `updateWeChatApp`                             | `updateWeChatApp`                             | ❌   | 未提供 tt.updateWeChatApp，调用时将返回 not supported                             |
| `uploadFile`                                  | `uploadFile`                                  | ✅   | 直连 `tt.uploadFile`                                                              |
| `vibrateLong`                                 | `vibrateLong`                                 | ✅   | 直连 `tt.vibrateLong`                                                             |
| `vibrateShort`                                | `vibrateShort`                                | ✅   | 直连 `tt.vibrateShort`                                                            |
| `writeBLECharacteristicValue`                 | `writeBLECharacteristicValue`                 | ❌   | 未提供 tt.writeBLECharacteristicValue，调用时将返回 not supported                 |
