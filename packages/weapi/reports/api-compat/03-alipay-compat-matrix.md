# 03 支付宝兼容矩阵（按微信命名）

总计：479，支持：192，不支持：287

| 微信 API                                      | 支付宝目标 API                                | 支持 | 策略                                                                              |
| --------------------------------------------- | --------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `addCard`                                     | `addCard`                                     | ❌   | 未提供 my.addCard，调用时将返回 not supported                                     |
| `addFileToFavorites`                          | `addFileToFavorites`                          | ❌   | 未提供 my.addFileToFavorites，调用时将返回 not supported                          |
| `addPaymentPassFinish`                        | `addPaymentPassFinish`                        | ❌   | 未提供 my.addPaymentPassFinish，调用时将返回 not supported                        |
| `addPaymentPassGetCertificateData`            | `addPaymentPassGetCertificateData`            | ❌   | 未提供 my.addPaymentPassGetCertificateData，调用时将返回 not supported            |
| `addPhoneCalendar`                            | `addPhoneCalendar`                            | ❌   | 未提供 my.addPhoneCalendar，调用时将返回 not supported                            |
| `addPhoneContact`                             | `addPhoneContact`                             | ✅   | 直连 `my.addPhoneContact`                                                         |
| `addPhoneRepeatCalendar`                      | `addPhoneRepeatCalendar`                      | ❌   | 未提供 my.addPhoneRepeatCalendar，调用时将返回 not supported                      |
| `addVideoToFavorites`                         | `addVideoToFavorites`                         | ❌   | 未提供 my.addVideoToFavorites，调用时将返回 not supported                         |
| `arrayBufferToBase64`                         | `arrayBufferToBase64`                         | ✅   | 直连 `my.arrayBufferToBase64`                                                     |
| `authorize`                                   | `authorize`                                   | ❌   | 未提供 my.authorize，调用时将返回 not supported                                   |
| `authorizeForMiniProgram`                     | `authorizeForMiniProgram`                     | ❌   | 未提供 my.authorizeForMiniProgram，调用时将返回 not supported                     |
| `authPrivateMessage`                          | `authPrivateMessage`                          | ❌   | 未提供 my.authPrivateMessage，调用时将返回 not supported                          |
| `base64ToArrayBuffer`                         | `base64ToArrayBuffer`                         | ✅   | 直连 `my.base64ToArrayBuffer`                                                     |
| `batchGetStorage`                             | `batchGetStorage`                             | ❌   | 未提供 my.batchGetStorage，调用时将返回 not supported                             |
| `batchGetStorageSync`                         | `batchGetStorageSync`                         | ❌   | 未提供 my.batchGetStorageSync，调用时将返回 not supported                         |
| `batchSetStorage`                             | `batchSetStorage`                             | ❌   | 未提供 my.batchSetStorage，调用时将返回 not supported                             |
| `batchSetStorageSync`                         | `batchSetStorageSync`                         | ❌   | 未提供 my.batchSetStorageSync，调用时将返回 not supported                         |
| `bindEmployeeRelation`                        | `bindEmployeeRelation`                        | ❌   | 未提供 my.bindEmployeeRelation，调用时将返回 not supported                        |
| `canAddSecureElementPass`                     | `canAddSecureElementPass`                     | ❌   | 未提供 my.canAddSecureElementPass，调用时将返回 not supported                     |
| `cancelIdleCallback`                          | `cancelIdleCallback`                          | ❌   | 未提供 my.cancelIdleCallback，调用时将返回 not supported                          |
| `canIUse`                                     | `canIUse`                                     | ✅   | 直连 `my.canIUse`                                                                 |
| `canvasGetImageData`                          | `canvasGetImageData`                          | ❌   | 未提供 my.canvasGetImageData，调用时将返回 not supported                          |
| `canvasPutImageData`                          | `canvasPutImageData`                          | ❌   | 未提供 my.canvasPutImageData，调用时将返回 not supported                          |
| `canvasToTempFilePath`                        | `canvasToTempFilePath`                        | ✅   | 直连 `my.canvasToTempFilePath`                                                    |
| `checkDeviceSupportHevc`                      | `checkDeviceSupportHevc`                      | ❌   | 未提供 my.checkDeviceSupportHevc，调用时将返回 not supported                      |
| `checkEmployeeRelation`                       | `checkEmployeeRelation`                       | ❌   | 未提供 my.checkEmployeeRelation，调用时将返回 not supported                       |
| `checkIsAddedToMyMiniProgram`                 | `checkIsAddedToMyMiniProgram`                 | ❌   | 未提供 my.checkIsAddedToMyMiniProgram，调用时将返回 not supported                 |
| `checkIsOpenAccessibility`                    | `checkIsOpenAccessibility`                    | ❌   | 未提供 my.checkIsOpenAccessibility，调用时将返回 not supported                    |
| `checkIsPictureInPictureActive`               | `checkIsPictureInPictureActive`               | ❌   | 未提供 my.checkIsPictureInPictureActive，调用时将返回 not supported               |
| `checkIsSoterEnrolledInDevice`                | `checkIsSoterEnrolledInDevice`                | ❌   | 未提供 my.checkIsSoterEnrolledInDevice，调用时将返回 not supported                |
| `checkIsSupportSoterAuthentication`           | `checkIsSupportSoterAuthentication`           | ❌   | 未提供 my.checkIsSupportSoterAuthentication，调用时将返回 not supported           |
| `checkSession`                                | `checkSession`                                | ❌   | 未提供 my.checkSession，调用时将返回 not supported                                |
| `chooseAddress`                               | `chooseAddress`                               | ❌   | 未提供 my.chooseAddress，调用时将返回 not supported                               |
| `chooseContact`                               | `chooseContact`                               | ✅   | 直连 `my.chooseContact`                                                           |
| `chooseImage`                                 | `chooseImage`                                 | ✅   | 返回值 `apFilePaths` 映射到 `tempFilePaths`                                       |
| `chooseInvoice`                               | `chooseInvoice`                               | ❌   | 未提供 my.chooseInvoice，调用时将返回 not supported                               |
| `chooseInvoiceTitle`                          | `chooseInvoiceTitle`                          | ❌   | 未提供 my.chooseInvoiceTitle，调用时将返回 not supported                          |
| `chooseLicensePlate`                          | `chooseLicensePlate`                          | ❌   | 未提供 my.chooseLicensePlate，调用时将返回 not supported                          |
| `chooseLocation`                              | `chooseLocation`                              | ✅   | 直连 `my.chooseLocation`                                                          |
| `chooseMedia`                                 | `chooseMedia`                                 | ❌   | 未提供 my.chooseMedia，调用时将返回 not supported                                 |
| `chooseMessageFile`                           | `chooseMessageFile`                           | ❌   | 未提供 my.chooseMessageFile，调用时将返回 not supported                           |
| `choosePoi`                                   | `choosePoi`                                   | ❌   | 未提供 my.choosePoi，调用时将返回 not supported                                   |
| `chooseVideo`                                 | `chooseVideo`                                 | ✅   | 直连 `my.chooseVideo`                                                             |
| `clearStorage`                                | `clearStorage`                                | ✅   | 直连 `my.clearStorage`                                                            |
| `clearStorageSync`                            | `clearStorageSync`                            | ✅   | 直连 `my.clearStorageSync`                                                        |
| `closeBLEConnection`                          | `closeBLEConnection`                          | ❌   | 未提供 my.closeBLEConnection，调用时将返回 not supported                          |
| `closeBluetoothAdapter`                       | `closeBluetoothAdapter`                       | ✅   | 直连 `my.closeBluetoothAdapter`                                                   |
| `closeSocket`                                 | `closeSocket`                                 | ✅   | 直连 `my.closeSocket`                                                             |
| `compressImage`                               | `compressImage`                               | ✅   | 直连 `my.compressImage`                                                           |
| `compressVideo`                               | `compressVideo`                               | ❌   | 未提供 my.compressVideo，调用时将返回 not supported                               |
| `connectSocket`                               | `connectSocket`                               | ✅   | 直连 `my.connectSocket`                                                           |
| `connectWifi`                                 | `connectWifi`                                 | ✅   | 直连 `my.connectWifi`                                                             |
| `createAnimation`                             | `createAnimation`                             | ✅   | 直连 `my.createAnimation`                                                         |
| `createAudioContext`                          | `createAudioContext`                          | ❌   | 未提供 my.createAudioContext，调用时将返回 not supported                          |
| `createBLEConnection`                         | `createBLEConnection`                         | ❌   | 未提供 my.createBLEConnection，调用时将返回 not supported                         |
| `createBLEPeripheralServer`                   | `createBLEPeripheralServer`                   | ❌   | 未提供 my.createBLEPeripheralServer，调用时将返回 not supported                   |
| `createBufferURL`                             | `createBufferURL`                             | ❌   | 未提供 my.createBufferURL，调用时将返回 not supported                             |
| `createCacheManager`                          | `createCacheManager`                          | ❌   | 未提供 my.createCacheManager，调用时将返回 not supported                          |
| `createCameraContext`                         | `createCameraContext`                         | ❌   | 未提供 my.createCameraContext，调用时将返回 not supported                         |
| `createCanvasContext`                         | `createCanvasContext`                         | ✅   | 直连 `my.createCanvasContext`                                                     |
| `createGlobalPayment`                         | `createGlobalPayment`                         | ❌   | 未提供 my.createGlobalPayment，调用时将返回 not supported                         |
| `createInferenceSession`                      | `createInferenceSession`                      | ❌   | 未提供 my.createInferenceSession，调用时将返回 not supported                      |
| `createInnerAudioContext`                     | `createInnerAudioContext`                     | ✅   | 直连 `my.createInnerAudioContext`                                                 |
| `createIntersectionObserver`                  | `createIntersectionObserver`                  | ✅   | 直连 `my.createIntersectionObserver`                                              |
| `createInterstitialAd`                        | `createInterstitialAd`                        | ❌   | 未提供 my.createInterstitialAd，调用时将返回 not supported                        |
| `createLivePlayerContext`                     | `createLivePlayerContext`                     | ❌   | 未提供 my.createLivePlayerContext，调用时将返回 not supported                     |
| `createLivePusherContext`                     | `createLivePusherContext`                     | ❌   | 未提供 my.createLivePusherContext，调用时将返回 not supported                     |
| `createMapContext`                            | `createMapContext`                            | ✅   | 直连 `my.createMapContext`                                                        |
| `createMediaAudioPlayer`                      | `createMediaAudioPlayer`                      | ❌   | 未提供 my.createMediaAudioPlayer，调用时将返回 not supported                      |
| `createMediaContainer`                        | `createMediaContainer`                        | ❌   | 未提供 my.createMediaContainer，调用时将返回 not supported                        |
| `createMediaRecorder`                         | `createMediaRecorder`                         | ❌   | 未提供 my.createMediaRecorder，调用时将返回 not supported                         |
| `createOffscreenCanvas`                       | `createOffscreenCanvas`                       | ✅   | 直连 `my.createOffscreenCanvas`                                                   |
| `createRewardedVideoAd`                       | `createRewardedVideoAd`                       | ❌   | 未提供 my.createRewardedVideoAd，调用时将返回 not supported                       |
| `createSelectorQuery`                         | `createSelectorQuery`                         | ✅   | 直连 `my.createSelectorQuery`                                                     |
| `createTCPSocket`                             | `createTCPSocket`                             | ❌   | 未提供 my.createTCPSocket，调用时将返回 not supported                             |
| `createUDPSocket`                             | `createUDPSocket`                             | ❌   | 未提供 my.createUDPSocket，调用时将返回 not supported                             |
| `createVideoContext`                          | `createVideoContext`                          | ✅   | 直连 `my.createVideoContext`                                                      |
| `createVideoDecoder`                          | `createVideoDecoder`                          | ❌   | 未提供 my.createVideoDecoder，调用时将返回 not supported                          |
| `createVKSession`                             | `createVKSession`                             | ❌   | 未提供 my.createVKSession，调用时将返回 not supported                             |
| `createWebAudioContext`                       | `createWebAudioContext`                       | ❌   | 未提供 my.createWebAudioContext，调用时将返回 not supported                       |
| `createWorker`                                | `createWorker`                                | ✅   | 直连 `my.createWorker`                                                            |
| `cropImage`                                   | `cropImage`                                   | ❌   | 未提供 my.cropImage，调用时将返回 not supported                                   |
| `disableAlertBeforeUnload`                    | `disableAlertBeforeUnload`                    | ✅   | 直连 `my.disableAlertBeforeUnload`                                                |
| `downloadFile`                                | `downloadFile`                                | ✅   | 直连 `my.downloadFile`                                                            |
| `editImage`                                   | `editImage`                                   | ❌   | 未提供 my.editImage，调用时将返回 not supported                                   |
| `enableAlertBeforeUnload`                     | `enableAlertBeforeUnload`                     | ✅   | 直连 `my.enableAlertBeforeUnload`                                                 |
| `exitMiniProgram`                             | `exitMiniProgram`                             | ✅   | 直连 `my.exitMiniProgram`                                                         |
| `exitVoIPChat`                                | `exitVoIPChat`                                | ❌   | 未提供 my.exitVoIPChat，调用时将返回 not supported                                |
| `faceDetect`                                  | `faceDetect`                                  | ❌   | 未提供 my.faceDetect，调用时将返回 not supported                                  |
| `getAccountInfoSync`                          | `getAccountInfoSync`                          | ✅   | 直连 `my.getAccountInfoSync`                                                      |
| `getApiCategory`                              | `getApiCategory`                              | ❌   | 未提供 my.getApiCategory，调用时将返回 not supported                              |
| `getAppAuthorizeSetting`                      | `getAppAuthorizeSetting`                      | ✅   | 直连 `my.getAppAuthorizeSetting`                                                  |
| `getAppBaseInfo`                              | `getAppBaseInfo`                              | ✅   | 直连 `my.getAppBaseInfo`                                                          |
| `getAvailableAudioSources`                    | `getAvailableAudioSources`                    | ✅   | 直连 `my.getAvailableAudioSources`                                                |
| `getBackgroundAudioManager`                   | `getBackgroundAudioManager`                   | ✅   | 直连 `my.getBackgroundAudioManager`                                               |
| `getBackgroundAudioPlayerState`               | `getBackgroundAudioPlayerState`               | ❌   | 未提供 my.getBackgroundAudioPlayerState，调用时将返回 not supported               |
| `getBackgroundFetchData`                      | `getBackgroundFetchData`                      | ✅   | 直连 `my.getBackgroundFetchData`                                                  |
| `getBackgroundFetchToken`                     | `getBackgroundFetchToken`                     | ❌   | 未提供 my.getBackgroundFetchToken，调用时将返回 not supported                     |
| `getBatteryInfo`                              | `getBatteryInfo`                              | ✅   | 直连 `my.getBatteryInfo`                                                          |
| `getBatteryInfoSync`                          | `getBatteryInfoSync`                          | ✅   | 直连 `my.getBatteryInfoSync`                                                      |
| `getBeacons`                                  | `getBeacons`                                  | ✅   | 直连 `my.getBeacons`                                                              |
| `getBLEDeviceCharacteristics`                 | `getBLEDeviceCharacteristics`                 | ✅   | 直连 `my.getBLEDeviceCharacteristics`                                             |
| `getBLEDeviceRSSI`                            | `getBLEDeviceRSSI`                            | ✅   | 直连 `my.getBLEDeviceRSSI`                                                        |
| `getBLEDeviceServices`                        | `getBLEDeviceServices`                        | ✅   | 直连 `my.getBLEDeviceServices`                                                    |
| `getBLEMTU`                                   | `getBLEMTU`                                   | ✅   | 直连 `my.getBLEMTU`                                                               |
| `getBluetoothAdapterState`                    | `getBluetoothAdapterState`                    | ✅   | 直连 `my.getBluetoothAdapterState`                                                |
| `getBluetoothDevices`                         | `getBluetoothDevices`                         | ✅   | 直连 `my.getBluetoothDevices`                                                     |
| `getChannelsLiveInfo`                         | `getChannelsLiveInfo`                         | ❌   | 未提供 my.getChannelsLiveInfo，调用时将返回 not supported                         |
| `getChannelsLiveNoticeInfo`                   | `getChannelsLiveNoticeInfo`                   | ❌   | 未提供 my.getChannelsLiveNoticeInfo，调用时将返回 not supported                   |
| `getChannelsShareKey`                         | `getChannelsShareKey`                         | ❌   | 未提供 my.getChannelsShareKey，调用时将返回 not supported                         |
| `getChatToolInfo`                             | `getChatToolInfo`                             | ❌   | 未提供 my.getChatToolInfo，调用时将返回 not supported                             |
| `getClipboardData`                            | `getClipboard`                                | ✅   | 转调 `my.getClipboard` 并映射 `text` → `data`                                     |
| `getCommonConfig`                             | `getCommonConfig`                             | ❌   | 未提供 my.getCommonConfig，调用时将返回 not supported                             |
| `getConnectedBluetoothDevices`                | `getConnectedBluetoothDevices`                | ✅   | 直连 `my.getConnectedBluetoothDevices`                                            |
| `getConnectedWifi`                            | `getConnectedWifi`                            | ✅   | 直连 `my.getConnectedWifi`                                                        |
| `getDeviceBenchmarkInfo`                      | `getDeviceBenchmarkInfo`                      | ❌   | 未提供 my.getDeviceBenchmarkInfo，调用时将返回 not supported                      |
| `getDeviceInfo`                               | `getDeviceInfo`                               | ❌   | 未提供 my.getDeviceInfo，调用时将返回 not supported                               |
| `getDeviceVoIPList`                           | `getDeviceVoIPList`                           | ❌   | 未提供 my.getDeviceVoIPList，调用时将返回 not supported                           |
| `getEnterOptionsSync`                         | `getEnterOptionsSync`                         | ✅   | 直连 `my.getEnterOptionsSync`                                                     |
| `getExptInfoSync`                             | `getExptInfoSync`                             | ❌   | 未提供 my.getExptInfoSync，调用时将返回 not supported                             |
| `getExtConfig`                                | `getExtConfig`                                | ✅   | 直连 `my.getExtConfig`                                                            |
| `getExtConfigSync`                            | `getExtConfigSync`                            | ✅   | 直连 `my.getExtConfigSync`                                                        |
| `getFileSystemManager`                        | `getFileSystemManager`                        | ✅   | 直连 `my.getFileSystemManager`                                                    |
| `getFuzzyLocation`                            | `getFuzzyLocation`                            | ❌   | 未提供 my.getFuzzyLocation，调用时将返回 not supported                            |
| `getGroupEnterInfo`                           | `getGroupEnterInfo`                           | ❌   | 未提供 my.getGroupEnterInfo，调用时将返回 not supported                           |
| `getHCEState`                                 | `getHCEState`                                 | ❌   | 未提供 my.getHCEState，调用时将返回 not supported                                 |
| `getImageInfo`                                | `getImageInfo`                                | ✅   | 直连 `my.getImageInfo`                                                            |
| `getInferenceEnvInfo`                         | `getInferenceEnvInfo`                         | ❌   | 未提供 my.getInferenceEnvInfo，调用时将返回 not supported                         |
| `getLaunchOptionsSync`                        | `getLaunchOptionsSync`                        | ✅   | 直连 `my.getLaunchOptionsSync`                                                    |
| `getLocalIPAddress`                           | `getLocalIPAddress`                           | ✅   | 直连 `my.getLocalIPAddress`                                                       |
| `getLocation`                                 | `getLocation`                                 | ✅   | 直连 `my.getLocation`                                                             |
| `getLogManager`                               | `getLogManager`                               | ❌   | 未提供 my.getLogManager，调用时将返回 not supported                               |
| `getMenuButtonBoundingClientRect`             | `getMenuButtonBoundingClientRect`             | ✅   | 直连 `my.getMenuButtonBoundingClientRect`                                         |
| `getNetworkType`                              | `getNetworkType`                              | ✅   | 直连 `my.getNetworkType`                                                          |
| `getNFCAdapter`                               | `getNFCAdapter`                               | ❌   | 未提供 my.getNFCAdapter，调用时将返回 not supported                               |
| `getPerformance`                              | `getPerformance`                              | ❌   | 未提供 my.getPerformance，调用时将返回 not supported                              |
| `getPrivacySetting`                           | `getPrivacySetting`                           | ❌   | 未提供 my.getPrivacySetting，调用时将返回 not supported                           |
| `getRandomValues`                             | `getRandomValues`                             | ❌   | 未提供 my.getRandomValues，调用时将返回 not supported                             |
| `getRealtimeLogManager`                       | `getRealtimeLogManager`                       | ❌   | 未提供 my.getRealtimeLogManager，调用时将返回 not supported                       |
| `getRecorderManager`                          | `getRecorderManager`                          | ✅   | 直连 `my.getRecorderManager`                                                      |
| `getRendererUserAgent`                        | `getRendererUserAgent`                        | ❌   | 未提供 my.getRendererUserAgent，调用时将返回 not supported                        |
| `getScreenBrightness`                         | `getScreenBrightness`                         | ✅   | 直连 `my.getScreenBrightness`                                                     |
| `getScreenRecordingState`                     | `getScreenRecordingState`                     | ❌   | 未提供 my.getScreenRecordingState，调用时将返回 not supported                     |
| `getSecureElementPasses`                      | `getSecureElementPasses`                      | ❌   | 未提供 my.getSecureElementPasses，调用时将返回 not supported                      |
| `getSelectedTextRange`                        | `getSelectedTextRange`                        | ❌   | 未提供 my.getSelectedTextRange，调用时将返回 not supported                        |
| `getSetting`                                  | `getSetting`                                  | ✅   | 直连 `my.getSetting`                                                              |
| `getShareInfo`                                | `getShareInfo`                                | ❌   | 未提供 my.getShareInfo，调用时将返回 not supported                                |
| `getShowSplashAdStatus`                       | `getShowSplashAdStatus`                       | ❌   | 未提供 my.getShowSplashAdStatus，调用时将返回 not supported                       |
| `getSkylineInfo`                              | `getSkylineInfo`                              | ❌   | 未提供 my.getSkylineInfo，调用时将返回 not supported                              |
| `getSkylineInfoSync`                          | `getSkylineInfoSync`                          | ❌   | 未提供 my.getSkylineInfoSync，调用时将返回 not supported                          |
| `getStorage`                                  | `getStorage`                                  | ✅   | 直连 `my.getStorage`                                                              |
| `getStorageInfo`                              | `getStorageInfo`                              | ✅   | 直连 `my.getStorageInfo`                                                          |
| `getStorageInfoSync`                          | `getStorageInfoSync`                          | ✅   | 直连 `my.getStorageInfoSync`                                                      |
| `getStorageSync`                              | `getStorageSync`                              | ✅   | 直连 `my.getStorageSync`                                                          |
| `getSystemInfo`                               | `getSystemInfo`                               | ✅   | 直连 `my.getSystemInfo`                                                           |
| `getSystemInfoAsync`                          | `getSystemInfoAsync`                          | ❌   | 未提供 my.getSystemInfoAsync，调用时将返回 not supported                          |
| `getSystemInfoSync`                           | `getSystemInfoSync`                           | ✅   | 直连 `my.getSystemInfoSync`                                                       |
| `getSystemSetting`                            | `getSystemSetting`                            | ✅   | 直连 `my.getSystemSetting`                                                        |
| `getUpdateManager`                            | `getUpdateManager`                            | ✅   | 直连 `my.getUpdateManager`                                                        |
| `getUserCryptoManager`                        | `getUserCryptoManager`                        | ❌   | 未提供 my.getUserCryptoManager，调用时将返回 not supported                        |
| `getUserInfo`                                 | `getUserInfo`                                 | ❌   | 未提供 my.getUserInfo，调用时将返回 not supported                                 |
| `getUserProfile`                              | `getUserProfile`                              | ❌   | 未提供 my.getUserProfile，调用时将返回 not supported                              |
| `getVideoInfo`                                | `getVideoInfo`                                | ✅   | 直连 `my.getVideoInfo`                                                            |
| `getWeRunData`                                | `getWeRunData`                                | ❌   | 未提供 my.getWeRunData，调用时将返回 not supported                                |
| `getWifiList`                                 | `getWifiList`                                 | ✅   | 直连 `my.getWifiList`                                                             |
| `getWindowInfo`                               | `getWindowInfo`                               | ✅   | 直连 `my.getWindowInfo`                                                           |
| `getXrFrameSystem`                            | `getXrFrameSystem`                            | ❌   | 未提供 my.getXrFrameSystem，调用时将返回 not supported                            |
| `hideHomeButton`                              | `hideHomeButton`                              | ❌   | 未提供 my.hideHomeButton，调用时将返回 not supported                              |
| `hideKeyboard`                                | `hideKeyboard`                                | ✅   | 直连 `my.hideKeyboard`                                                            |
| `hideLoading`                                 | `hideLoading`                                 | ✅   | 直连 `my.hideLoading`                                                             |
| `hideNavigationBarLoading`                    | `hideNavigationBarLoading`                    | ✅   | 直连 `my.hideNavigationBarLoading`                                                |
| `hideShareMenu`                               | `hideShareMenu`                               | ✅   | 直连 `my.hideShareMenu`                                                           |
| `hideTabBar`                                  | `hideTabBar`                                  | ✅   | 直连 `my.hideTabBar`                                                              |
| `hideTabBarRedDot`                            | `hideTabBarRedDot`                            | ✅   | 直连 `my.hideTabBarRedDot`                                                        |
| `hideToast`                                   | `hideToast`                                   | ✅   | 直连 `my.hideToast`                                                               |
| `initFaceDetect`                              | `initFaceDetect`                              | ❌   | 未提供 my.initFaceDetect，调用时将返回 not supported                              |
| `isBluetoothDevicePaired`                     | `isBluetoothDevicePaired`                     | ❌   | 未提供 my.isBluetoothDevicePaired，调用时将返回 not supported                     |
| `isVKSupport`                                 | `isVKSupport`                                 | ❌   | 未提供 my.isVKSupport，调用时将返回 not supported                                 |
| `join1v1Chat`                                 | `join1v1Chat`                                 | ❌   | 未提供 my.join1v1Chat，调用时将返回 not supported                                 |
| `joinVoIPChat`                                | `joinVoIPChat`                                | ❌   | 未提供 my.joinVoIPChat，调用时将返回 not supported                                |
| `loadBuiltInFontFace`                         | `loadBuiltInFontFace`                         | ❌   | 未提供 my.loadBuiltInFontFace，调用时将返回 not supported                         |
| `loadFontFace`                                | `loadFontFace`                                | ✅   | 直连 `my.loadFontFace`                                                            |
| `login`                                       | `login`                                       | ❌   | 未提供 my.login，调用时将返回 not supported                                       |
| `makeBluetoothPair`                           | `makeBluetoothPair`                           | ✅   | 直连 `my.makeBluetoothPair`                                                       |
| `makePhoneCall`                               | `makePhoneCall`                               | ✅   | 直连 `my.makePhoneCall`                                                           |
| `navigateBack`                                | `navigateBack`                                | ✅   | 直连 `my.navigateBack`                                                            |
| `navigateBackMiniProgram`                     | `navigateBackMiniProgram`                     | ✅   | 直连 `my.navigateBackMiniProgram`                                                 |
| `navigateTo`                                  | `navigateTo`                                  | ✅   | 直连 `my.navigateTo`                                                              |
| `navigateToMiniProgram`                       | `navigateToMiniProgram`                       | ✅   | 直连 `my.navigateToMiniProgram`                                                   |
| `nextTick`                                    | `nextTick`                                    | ❌   | 未提供 my.nextTick，调用时将返回 not supported                                    |
| `notifyBLECharacteristicValueChange`          | `notifyBLECharacteristicValueChange`          | ✅   | 直连 `my.notifyBLECharacteristicValueChange`                                      |
| `notifyGroupMembers`                          | `notifyGroupMembers`                          | ❌   | 未提供 my.notifyGroupMembers，调用时将返回 not supported                          |
| `offAccelerometerChange`                      | `offAccelerometerChange`                      | ✅   | 直连 `my.offAccelerometerChange`                                                  |
| `offAfterPageLoad`                            | `offAfterPageLoad`                            | ❌   | 未提供 my.offAfterPageLoad，调用时将返回 not supported                            |
| `offAfterPageUnload`                          | `offAfterPageUnload`                          | ❌   | 未提供 my.offAfterPageUnload，调用时将返回 not supported                          |
| `offApiCategoryChange`                        | `offApiCategoryChange`                        | ❌   | 未提供 my.offApiCategoryChange，调用时将返回 not supported                        |
| `offAppHide`                                  | `offAppHide`                                  | ✅   | 直连 `my.offAppHide`                                                              |
| `offAppRoute`                                 | `offAppRoute`                                 | ❌   | 未提供 my.offAppRoute，调用时将返回 not supported                                 |
| `offAppRouteDone`                             | `offAppRouteDone`                             | ❌   | 未提供 my.offAppRouteDone，调用时将返回 not supported                             |
| `offAppShow`                                  | `offAppShow`                                  | ✅   | 直连 `my.offAppShow`                                                              |
| `offAudioInterruptionBegin`                   | `offAudioInterruptionBegin`                   | ✅   | 直连 `my.offAudioInterruptionBegin`                                               |
| `offAudioInterruptionEnd`                     | `offAudioInterruptionEnd`                     | ✅   | 直连 `my.offAudioInterruptionEnd`                                                 |
| `offBatteryInfoChange`                        | `offBatteryInfoChange`                        | ❌   | 未提供 my.offBatteryInfoChange，调用时将返回 not supported                        |
| `offBeaconServiceChange`                      | `offBeaconServiceChange`                      | ✅   | 直连 `my.offBeaconServiceChange`                                                  |
| `offBeaconUpdate`                             | `offBeaconUpdate`                             | ✅   | 直连 `my.offBeaconUpdate`                                                         |
| `offBeforeAppRoute`                           | `offBeforeAppRoute`                           | ❌   | 未提供 my.offBeforeAppRoute，调用时将返回 not supported                           |
| `offBeforePageLoad`                           | `offBeforePageLoad`                           | ❌   | 未提供 my.offBeforePageLoad，调用时将返回 not supported                           |
| `offBeforePageUnload`                         | `offBeforePageUnload`                         | ❌   | 未提供 my.offBeforePageUnload，调用时将返回 not supported                         |
| `offBLECharacteristicValueChange`             | `offBLECharacteristicValueChange`             | ✅   | 直连 `my.offBLECharacteristicValueChange`                                         |
| `offBLEConnectionStateChange`                 | `offBLEConnectionStateChange`                 | ❌   | 未提供 my.offBLEConnectionStateChange，调用时将返回 not supported                 |
| `offBLEMTUChange`                             | `offBLEMTUChange`                             | ❌   | 未提供 my.offBLEMTUChange，调用时将返回 not supported                             |
| `offBLEPeripheralConnectionStateChanged`      | `offBLEPeripheralConnectionStateChanged`      | ❌   | 未提供 my.offBLEPeripheralConnectionStateChanged，调用时将返回 not supported      |
| `offBluetoothAdapterStateChange`              | `offBluetoothAdapterStateChange`              | ✅   | 直连 `my.offBluetoothAdapterStateChange`                                          |
| `offBluetoothDeviceFound`                     | `offBluetoothDeviceFound`                     | ✅   | 直连 `my.offBluetoothDeviceFound`                                                 |
| `offCompassChange`                            | `offCompassChange`                            | ✅   | 直连 `my.offCompassChange`                                                        |
| `offCopyUrl`                                  | `offCopyUrl`                                  | ❌   | 未提供 my.offCopyUrl，调用时将返回 not supported                                  |
| `offDeviceMotionChange`                       | `offDeviceMotionChange`                       | ✅   | 直连 `my.offDeviceMotionChange`                                                   |
| `offEmbeddedMiniProgramHeightChange`          | `offEmbeddedMiniProgramHeightChange`          | ❌   | 未提供 my.offEmbeddedMiniProgramHeightChange，调用时将返回 not supported          |
| `offError`                                    | `offError`                                    | ✅   | 直连 `my.offError`                                                                |
| `offGeneratePoster`                           | `offGeneratePoster`                           | ❌   | 未提供 my.offGeneratePoster，调用时将返回 not supported                           |
| `offGetWifiList`                              | `offGetWifiList`                              | ✅   | 直连 `my.offGetWifiList`                                                          |
| `offGyroscopeChange`                          | `offGyroscopeChange`                          | ✅   | 直连 `my.offGyroscopeChange`                                                      |
| `offHCEMessage`                               | `offHCEMessage`                               | ❌   | 未提供 my.offHCEMessage，调用时将返回 not supported                               |
| `offKeyboardHeightChange`                     | `offKeyboardHeightChange`                     | ❌   | 未提供 my.offKeyboardHeightChange，调用时将返回 not supported                     |
| `offKeyDown`                                  | `offKeyDown`                                  | ❌   | 未提供 my.offKeyDown，调用时将返回 not supported                                  |
| `offKeyUp`                                    | `offKeyUp`                                    | ❌   | 未提供 my.offKeyUp，调用时将返回 not supported                                    |
| `offLazyLoadError`                            | `offLazyLoadError`                            | ❌   | 未提供 my.offLazyLoadError，调用时将返回 not supported                            |
| `offLocalServiceDiscoveryStop`                | `offLocalServiceDiscoveryStop`                | ❌   | 未提供 my.offLocalServiceDiscoveryStop，调用时将返回 not supported                |
| `offLocalServiceFound`                        | `offLocalServiceFound`                        | ❌   | 未提供 my.offLocalServiceFound，调用时将返回 not supported                        |
| `offLocalServiceLost`                         | `offLocalServiceLost`                         | ❌   | 未提供 my.offLocalServiceLost，调用时将返回 not supported                         |
| `offLocalServiceResolveFail`                  | `offLocalServiceResolveFail`                  | ❌   | 未提供 my.offLocalServiceResolveFail，调用时将返回 not supported                  |
| `offLocationChange`                           | `offLocationChange`                           | ❌   | 未提供 my.offLocationChange，调用时将返回 not supported                           |
| `offLocationChangeError`                      | `offLocationChangeError`                      | ❌   | 未提供 my.offLocationChangeError，调用时将返回 not supported                      |
| `offMemoryWarning`                            | `offMemoryWarning`                            | ✅   | 直连 `my.offMemoryWarning`                                                        |
| `offMenuButtonBoundingClientRectWeightChange` | `offMenuButtonBoundingClientRectWeightChange` | ❌   | 未提供 my.offMenuButtonBoundingClientRectWeightChange，调用时将返回 not supported |
| `offNetworkStatusChange`                      | `offNetworkStatusChange`                      | ✅   | 直连 `my.offNetworkStatusChange`                                                  |
| `offNetworkWeakChange`                        | `offNetworkWeakChange`                        | ❌   | 未提供 my.offNetworkWeakChange，调用时将返回 not supported                        |
| `offOnUserTriggerTranslation`                 | `offOnUserTriggerTranslation`                 | ❌   | 未提供 my.offOnUserTriggerTranslation，调用时将返回 not supported                 |
| `offPageNotFound`                             | `offPageNotFound`                             | ✅   | 直连 `my.offPageNotFound`                                                         |
| `offParallelStateChange`                      | `offParallelStateChange`                      | ❌   | 未提供 my.offParallelStateChange，调用时将返回 not supported                      |
| `offScreenRecordingStateChanged`              | `offScreenRecordingStateChanged`              | ❌   | 未提供 my.offScreenRecordingStateChanged，调用时将返回 not supported              |
| `offThemeChange`                              | `offThemeChange`                              | ❌   | 未提供 my.offThemeChange，调用时将返回 not supported                              |
| `offUnhandledRejection`                       | `offUnhandledRejection`                       | ✅   | 直连 `my.offUnhandledRejection`                                                   |
| `offUserCaptureScreen`                        | `offUserCaptureScreen`                        | ✅   | 直连 `my.offUserCaptureScreen`                                                    |
| `offVoIPChatInterrupted`                      | `offVoIPChatInterrupted`                      | ❌   | 未提供 my.offVoIPChatInterrupted，调用时将返回 not supported                      |
| `offVoIPChatMembersChanged`                   | `offVoIPChatMembersChanged`                   | ❌   | 未提供 my.offVoIPChatMembersChanged，调用时将返回 not supported                   |
| `offVoIPChatSpeakersChanged`                  | `offVoIPChatSpeakersChanged`                  | ❌   | 未提供 my.offVoIPChatSpeakersChanged，调用时将返回 not supported                  |
| `offVoIPChatStateChanged`                     | `offVoIPChatStateChanged`                     | ❌   | 未提供 my.offVoIPChatStateChanged，调用时将返回 not supported                     |
| `offVoIPVideoMembersChanged`                  | `offVoIPVideoMembersChanged`                  | ❌   | 未提供 my.offVoIPVideoMembersChanged，调用时将返回 not supported                  |
| `offWifiConnected`                            | `offWifiConnected`                            | ✅   | 直连 `my.offWifiConnected`                                                        |
| `offWifiConnectedWithPartialInfo`             | `offWifiConnectedWithPartialInfo`             | ❌   | 未提供 my.offWifiConnectedWithPartialInfo，调用时将返回 not supported             |
| `offWindowResize`                             | `offWindowResize`                             | ❌   | 未提供 my.offWindowResize，调用时将返回 not supported                             |
| `offWindowStateChange`                        | `offWindowStateChange`                        | ❌   | 未提供 my.offWindowStateChange，调用时将返回 not supported                        |
| `onAccelerometerChange`                       | `onAccelerometerChange`                       | ✅   | 直连 `my.onAccelerometerChange`                                                   |
| `onAfterPageLoad`                             | `onAfterPageLoad`                             | ❌   | 未提供 my.onAfterPageLoad，调用时将返回 not supported                             |
| `onAfterPageUnload`                           | `onAfterPageUnload`                           | ❌   | 未提供 my.onAfterPageUnload，调用时将返回 not supported                           |
| `onApiCategoryChange`                         | `onApiCategoryChange`                         | ❌   | 未提供 my.onApiCategoryChange，调用时将返回 not supported                         |
| `onAppHide`                                   | `onAppHide`                                   | ✅   | 直连 `my.onAppHide`                                                               |
| `onAppRoute`                                  | `onAppRoute`                                  | ❌   | 未提供 my.onAppRoute，调用时将返回 not supported                                  |
| `onAppRouteDone`                              | `onAppRouteDone`                              | ❌   | 未提供 my.onAppRouteDone，调用时将返回 not supported                              |
| `onAppShow`                                   | `onAppShow`                                   | ✅   | 直连 `my.onAppShow`                                                               |
| `onAudioInterruptionBegin`                    | `onAudioInterruptionBegin`                    | ✅   | 直连 `my.onAudioInterruptionBegin`                                                |
| `onAudioInterruptionEnd`                      | `onAudioInterruptionEnd`                      | ✅   | 直连 `my.onAudioInterruptionEnd`                                                  |
| `onBackgroundAudioPause`                      | `onBackgroundAudioPause`                      | ❌   | 未提供 my.onBackgroundAudioPause，调用时将返回 not supported                      |
| `onBackgroundAudioPlay`                       | `onBackgroundAudioPlay`                       | ❌   | 未提供 my.onBackgroundAudioPlay，调用时将返回 not supported                       |
| `onBackgroundAudioStop`                       | `onBackgroundAudioStop`                       | ❌   | 未提供 my.onBackgroundAudioStop，调用时将返回 not supported                       |
| `onBackgroundFetchData`                       | `onBackgroundFetchData`                       | ❌   | 未提供 my.onBackgroundFetchData，调用时将返回 not supported                       |
| `onBatteryInfoChange`                         | `onBatteryInfoChange`                         | ❌   | 未提供 my.onBatteryInfoChange，调用时将返回 not supported                         |
| `onBeaconServiceChange`                       | `onBeaconServiceChange`                       | ✅   | 直连 `my.onBeaconServiceChange`                                                   |
| `onBeaconUpdate`                              | `onBeaconUpdate`                              | ✅   | 直连 `my.onBeaconUpdate`                                                          |
| `onBeforeAppRoute`                            | `onBeforeAppRoute`                            | ❌   | 未提供 my.onBeforeAppRoute，调用时将返回 not supported                            |
| `onBeforePageLoad`                            | `onBeforePageLoad`                            | ❌   | 未提供 my.onBeforePageLoad，调用时将返回 not supported                            |
| `onBeforePageUnload`                          | `onBeforePageUnload`                          | ❌   | 未提供 my.onBeforePageUnload，调用时将返回 not supported                          |
| `onBLECharacteristicValueChange`              | `onBLECharacteristicValueChange`              | ✅   | 直连 `my.onBLECharacteristicValueChange`                                          |
| `onBLEConnectionStateChange`                  | `onBLEConnectionStateChange`                  | ❌   | 未提供 my.onBLEConnectionStateChange，调用时将返回 not supported                  |
| `onBLEMTUChange`                              | `onBLEMTUChange`                              | ❌   | 未提供 my.onBLEMTUChange，调用时将返回 not supported                              |
| `onBLEPeripheralConnectionStateChanged`       | `onBLEPeripheralConnectionStateChanged`       | ❌   | 未提供 my.onBLEPeripheralConnectionStateChanged，调用时将返回 not supported       |
| `onBluetoothAdapterStateChange`               | `onBluetoothAdapterStateChange`               | ✅   | 直连 `my.onBluetoothAdapterStateChange`                                           |
| `onBluetoothDeviceFound`                      | `onBluetoothDeviceFound`                      | ✅   | 直连 `my.onBluetoothDeviceFound`                                                  |
| `onCompassChange`                             | `onCompassChange`                             | ✅   | 直连 `my.onCompassChange`                                                         |
| `onCopyUrl`                                   | `onCopyUrl`                                   | ❌   | 未提供 my.onCopyUrl，调用时将返回 not supported                                   |
| `onDeviceMotionChange`                        | `onDeviceMotionChange`                        | ✅   | 直连 `my.onDeviceMotionChange`                                                    |
| `onEmbeddedMiniProgramHeightChange`           | `onEmbeddedMiniProgramHeightChange`           | ❌   | 未提供 my.onEmbeddedMiniProgramHeightChange，调用时将返回 not supported           |
| `onError`                                     | `onError`                                     | ✅   | 直连 `my.onError`                                                                 |
| `onGeneratePoster`                            | `onGeneratePoster`                            | ❌   | 未提供 my.onGeneratePoster，调用时将返回 not supported                            |
| `onGetWifiList`                               | `onGetWifiList`                               | ✅   | 直连 `my.onGetWifiList`                                                           |
| `onGyroscopeChange`                           | `onGyroscopeChange`                           | ✅   | 直连 `my.onGyroscopeChange`                                                       |
| `onHCEMessage`                                | `onHCEMessage`                                | ❌   | 未提供 my.onHCEMessage，调用时将返回 not supported                                |
| `onKeyboardHeightChange`                      | `onKeyboardHeightChange`                      | ❌   | 未提供 my.onKeyboardHeightChange，调用时将返回 not supported                      |
| `onKeyDown`                                   | `onKeyDown`                                   | ❌   | 未提供 my.onKeyDown，调用时将返回 not supported                                   |
| `onKeyUp`                                     | `onKeyUp`                                     | ❌   | 未提供 my.onKeyUp，调用时将返回 not supported                                     |
| `onLazyLoadError`                             | `onLazyLoadError`                             | ❌   | 未提供 my.onLazyLoadError，调用时将返回 not supported                             |
| `onLocalServiceDiscoveryStop`                 | `onLocalServiceDiscoveryStop`                 | ❌   | 未提供 my.onLocalServiceDiscoveryStop，调用时将返回 not supported                 |
| `onLocalServiceFound`                         | `onLocalServiceFound`                         | ❌   | 未提供 my.onLocalServiceFound，调用时将返回 not supported                         |
| `onLocalServiceLost`                          | `onLocalServiceLost`                          | ❌   | 未提供 my.onLocalServiceLost，调用时将返回 not supported                          |
| `onLocalServiceResolveFail`                   | `onLocalServiceResolveFail`                   | ❌   | 未提供 my.onLocalServiceResolveFail，调用时将返回 not supported                   |
| `onLocationChange`                            | `onLocationChange`                            | ❌   | 未提供 my.onLocationChange，调用时将返回 not supported                            |
| `onLocationChangeError`                       | `onLocationChangeError`                       | ❌   | 未提供 my.onLocationChangeError，调用时将返回 not supported                       |
| `onMemoryWarning`                             | `onMemoryWarning`                             | ✅   | 直连 `my.onMemoryWarning`                                                         |
| `onMenuButtonBoundingClientRectWeightChange`  | `onMenuButtonBoundingClientRectWeightChange`  | ❌   | 未提供 my.onMenuButtonBoundingClientRectWeightChange，调用时将返回 not supported  |
| `onNeedPrivacyAuthorization`                  | `onNeedPrivacyAuthorization`                  | ❌   | 未提供 my.onNeedPrivacyAuthorization，调用时将返回 not supported                  |
| `onNetworkStatusChange`                       | `onNetworkStatusChange`                       | ✅   | 直连 `my.onNetworkStatusChange`                                                   |
| `onNetworkWeakChange`                         | `onNetworkWeakChange`                         | ❌   | 未提供 my.onNetworkWeakChange，调用时将返回 not supported                         |
| `onOnUserTriggerTranslation`                  | `onOnUserTriggerTranslation`                  | ❌   | 未提供 my.onOnUserTriggerTranslation，调用时将返回 not supported                  |
| `onPageNotFound`                              | `onPageNotFound`                              | ✅   | 直连 `my.onPageNotFound`                                                          |
| `onParallelStateChange`                       | `onParallelStateChange`                       | ❌   | 未提供 my.onParallelStateChange，调用时将返回 not supported                       |
| `onScreenRecordingStateChanged`               | `onScreenRecordingStateChanged`               | ❌   | 未提供 my.onScreenRecordingStateChanged，调用时将返回 not supported               |
| `onSocketClose`                               | `onSocketClose`                               | ✅   | 直连 `my.onSocketClose`                                                           |
| `onSocketError`                               | `onSocketError`                               | ✅   | 直连 `my.onSocketError`                                                           |
| `onSocketMessage`                             | `onSocketMessage`                             | ✅   | 直连 `my.onSocketMessage`                                                         |
| `onSocketOpen`                                | `onSocketOpen`                                | ✅   | 直连 `my.onSocketOpen`                                                            |
| `onThemeChange`                               | `onThemeChange`                               | ❌   | 未提供 my.onThemeChange，调用时将返回 not supported                               |
| `onUnhandledRejection`                        | `onUnhandledRejection`                        | ✅   | 直连 `my.onUnhandledRejection`                                                    |
| `onUserCaptureScreen`                         | `onUserCaptureScreen`                         | ✅   | 直连 `my.onUserCaptureScreen`                                                     |
| `onVoIPChatInterrupted`                       | `onVoIPChatInterrupted`                       | ❌   | 未提供 my.onVoIPChatInterrupted，调用时将返回 not supported                       |
| `onVoIPChatMembersChanged`                    | `onVoIPChatMembersChanged`                    | ❌   | 未提供 my.onVoIPChatMembersChanged，调用时将返回 not supported                    |
| `onVoIPChatSpeakersChanged`                   | `onVoIPChatSpeakersChanged`                   | ❌   | 未提供 my.onVoIPChatSpeakersChanged，调用时将返回 not supported                   |
| `onVoIPChatStateChanged`                      | `onVoIPChatStateChanged`                      | ❌   | 未提供 my.onVoIPChatStateChanged，调用时将返回 not supported                      |
| `onVoIPVideoMembersChanged`                   | `onVoIPVideoMembersChanged`                   | ❌   | 未提供 my.onVoIPVideoMembersChanged，调用时将返回 not supported                   |
| `onWifiConnected`                             | `onWifiConnected`                             | ✅   | 直连 `my.onWifiConnected`                                                         |
| `onWifiConnectedWithPartialInfo`              | `onWifiConnectedWithPartialInfo`              | ❌   | 未提供 my.onWifiConnectedWithPartialInfo，调用时将返回 not supported              |
| `onWindowResize`                              | `onWindowResize`                              | ❌   | 未提供 my.onWindowResize，调用时将返回 not supported                              |
| `onWindowStateChange`                         | `onWindowStateChange`                         | ❌   | 未提供 my.onWindowStateChange，调用时将返回 not supported                         |
| `openAppAuthorizeSetting`                     | `openAppAuthorizeSetting`                     | ❌   | 未提供 my.openAppAuthorizeSetting，调用时将返回 not supported                     |
| `openBluetoothAdapter`                        | `openBluetoothAdapter`                        | ✅   | 直连 `my.openBluetoothAdapter`                                                    |
| `openCard`                                    | `openCard`                                    | ❌   | 未提供 my.openCard，调用时将返回 not supported                                    |
| `openChannelsActivity`                        | `openChannelsActivity`                        | ❌   | 未提供 my.openChannelsActivity，调用时将返回 not supported                        |
| `openChannelsEvent`                           | `openChannelsEvent`                           | ❌   | 未提供 my.openChannelsEvent，调用时将返回 not supported                           |
| `openChannelsLive`                            | `openChannelsLive`                            | ❌   | 未提供 my.openChannelsLive，调用时将返回 not supported                            |
| `openChannelsLiveNoticeInfo`                  | `openChannelsLiveNoticeInfo`                  | ❌   | 未提供 my.openChannelsLiveNoticeInfo，调用时将返回 not supported                  |
| `openChannelsUserProfile`                     | `openChannelsUserProfile`                     | ❌   | 未提供 my.openChannelsUserProfile，调用时将返回 not supported                     |
| `openChatTool`                                | `openChatTool`                                | ❌   | 未提供 my.openChatTool，调用时将返回 not supported                                |
| `openCustomerServiceChat`                     | `openCustomerServiceChat`                     | ❌   | 未提供 my.openCustomerServiceChat，调用时将返回 not supported                     |
| `openDocument`                                | `openDocument`                                | ✅   | 直连 `my.openDocument`                                                            |
| `openEmbeddedMiniProgram`                     | `openEmbeddedMiniProgram`                     | ❌   | 未提供 my.openEmbeddedMiniProgram，调用时将返回 not supported                     |
| `openHKOfflinePayView`                        | `openHKOfflinePayView`                        | ❌   | 未提供 my.openHKOfflinePayView，调用时将返回 not supported                        |
| `openInquiriesTopic`                          | `openInquiriesTopic`                          | ❌   | 未提供 my.openInquiriesTopic，调用时将返回 not supported                          |
| `openLocation`                                | `openLocation`                                | ✅   | 直连 `my.openLocation`                                                            |
| `openOfficialAccountArticle`                  | `openOfficialAccountArticle`                  | ❌   | 未提供 my.openOfficialAccountArticle，调用时将返回 not supported                  |
| `openOfficialAccountChat`                     | `openOfficialAccountChat`                     | ❌   | 未提供 my.openOfficialAccountChat，调用时将返回 not supported                     |
| `openOfficialAccountProfile`                  | `openOfficialAccountProfile`                  | ❌   | 未提供 my.openOfficialAccountProfile，调用时将返回 not supported                  |
| `openPrivacyContract`                         | `openPrivacyContract`                         | ❌   | 未提供 my.openPrivacyContract，调用时将返回 not supported                         |
| `openSetting`                                 | `openSetting`                                 | ✅   | 直连 `my.openSetting`                                                             |
| `openSingleStickerView`                       | `openSingleStickerView`                       | ❌   | 未提供 my.openSingleStickerView，调用时将返回 not supported                       |
| `openStickerIPView`                           | `openStickerIPView`                           | ❌   | 未提供 my.openStickerIPView，调用时将返回 not supported                           |
| `openStickerSetView`                          | `openStickerSetView`                          | ❌   | 未提供 my.openStickerSetView，调用时将返回 not supported                          |
| `openStoreCouponDetail`                       | `openStoreCouponDetail`                       | ❌   | 未提供 my.openStoreCouponDetail，调用时将返回 not supported                       |
| `openStoreOrderDetail`                        | `openStoreOrderDetail`                        | ❌   | 未提供 my.openStoreOrderDetail，调用时将返回 not supported                        |
| `openSystemBluetoothSetting`                  | `openSystemBluetoothSetting`                  | ❌   | 未提供 my.openSystemBluetoothSetting，调用时将返回 not supported                  |
| `openVideoEditor`                             | `openVideoEditor`                             | ❌   | 未提供 my.openVideoEditor，调用时将返回 not supported                             |
| `pageScrollTo`                                | `pageScrollTo`                                | ✅   | 直连 `my.pageScrollTo`                                                            |
| `pauseBackgroundAudio`                        | `pauseBackgroundAudio`                        | ❌   | 未提供 my.pauseBackgroundAudio，调用时将返回 not supported                        |
| `pauseVoice`                                  | `pauseVoice`                                  | ❌   | 未提供 my.pauseVoice，调用时将返回 not supported                                  |
| `playBackgroundAudio`                         | `playBackgroundAudio`                         | ❌   | 未提供 my.playBackgroundAudio，调用时将返回 not supported                         |
| `playVoice`                                   | `playVoice`                                   | ❌   | 未提供 my.playVoice，调用时将返回 not supported                                   |
| `pluginLogin`                                 | `pluginLogin`                                 | ❌   | 未提供 my.pluginLogin，调用时将返回 not supported                                 |
| `postMessageToReferrerMiniProgram`            | `postMessageToReferrerMiniProgram`            | ❌   | 未提供 my.postMessageToReferrerMiniProgram，调用时将返回 not supported            |
| `postMessageToReferrerPage`                   | `postMessageToReferrerPage`                   | ❌   | 未提供 my.postMessageToReferrerPage，调用时将返回 not supported                   |
| `preDownloadSubpackage`                       | `preDownloadSubpackage`                       | ❌   | 未提供 my.preDownloadSubpackage，调用时将返回 not supported                       |
| `preloadAssets`                               | `preloadAssets`                               | ❌   | 未提供 my.preloadAssets，调用时将返回 not supported                               |
| `preloadSkylineView`                          | `preloadSkylineView`                          | ❌   | 未提供 my.preloadSkylineView，调用时将返回 not supported                          |
| `preloadWebview`                              | `preloadWebview`                              | ❌   | 未提供 my.preloadWebview，调用时将返回 not supported                              |
| `previewImage`                                | `previewImage`                                | ✅   | 直连 `my.previewImage`                                                            |
| `previewMedia`                                | `previewMedia`                                | ❌   | 未提供 my.previewMedia，调用时将返回 not supported                                |
| `readBLECharacteristicValue`                  | `readBLECharacteristicValue`                  | ✅   | 直连 `my.readBLECharacteristicValue`                                              |
| `redirectTo`                                  | `redirectTo`                                  | ✅   | 直连 `my.redirectTo`                                                              |
| `reLaunch`                                    | `reLaunch`                                    | ✅   | 直连 `my.reLaunch`                                                                |
| `removeSecureElementPass`                     | `removeSecureElementPass`                     | ❌   | 未提供 my.removeSecureElementPass，调用时将返回 not supported                     |
| `removeStorage`                               | `removeStorage`                               | ✅   | 直连 `my.removeStorage`                                                           |
| `removeStorageSync`                           | `removeStorageSync`                           | ✅   | 直连 `my.removeStorageSync`                                                       |
| `removeTabBarBadge`                           | `removeTabBarBadge`                           | ✅   | 直连 `my.removeTabBarBadge`                                                       |
| `reportAnalytics`                             | `reportAnalytics`                             | ❌   | 未提供 my.reportAnalytics，调用时将返回 not supported                             |
| `reportEvent`                                 | `reportEvent`                                 | ❌   | 未提供 my.reportEvent，调用时将返回 not supported                                 |
| `reportMonitor`                               | `reportMonitor`                               | ❌   | 未提供 my.reportMonitor，调用时将返回 not supported                               |
| `reportPerformance`                           | `reportPerformance`                           | ❌   | 未提供 my.reportPerformance，调用时将返回 not supported                           |
| `request`                                     | `request`                                     | ✅   | 直连 `my.request`                                                                 |
| `requestCommonPayment`                        | `requestCommonPayment`                        | ❌   | 未提供 my.requestCommonPayment，调用时将返回 not supported                        |
| `requestDeviceVoIP`                           | `requestDeviceVoIP`                           | ❌   | 未提供 my.requestDeviceVoIP，调用时将返回 not supported                           |
| `requestIdleCallback`                         | `requestIdleCallback`                         | ❌   | 未提供 my.requestIdleCallback，调用时将返回 not supported                         |
| `requestMerchantTransfer`                     | `requestMerchantTransfer`                     | ❌   | 未提供 my.requestMerchantTransfer，调用时将返回 not supported                     |
| `requestOrderPayment`                         | `requestOrderPayment`                         | ❌   | 未提供 my.requestOrderPayment，调用时将返回 not supported                         |
| `requestPayment`                              | `requestPayment`                              | ❌   | 未提供 my.requestPayment，调用时将返回 not supported                              |
| `requestPluginPayment`                        | `requestPluginPayment`                        | ❌   | 未提供 my.requestPluginPayment，调用时将返回 not supported                        |
| `requestSubscribeDeviceMessage`               | `requestSubscribeDeviceMessage`               | ❌   | 未提供 my.requestSubscribeDeviceMessage，调用时将返回 not supported               |
| `requestSubscribeEmployeeMessage`             | `requestSubscribeEmployeeMessage`             | ❌   | 未提供 my.requestSubscribeEmployeeMessage，调用时将返回 not supported             |
| `requestSubscribeMessage`                     | `requestSubscribeMessage`                     | ✅   | 直连 `my.requestSubscribeMessage`                                                 |
| `requestVirtualPayment`                       | `requestVirtualPayment`                       | ❌   | 未提供 my.requestVirtualPayment，调用时将返回 not supported                       |
| `requirePrivacyAuthorize`                     | `requirePrivacyAuthorize`                     | ❌   | 未提供 my.requirePrivacyAuthorize，调用时将返回 not supported                     |
| `reserveChannelsLive`                         | `reserveChannelsLive`                         | ❌   | 未提供 my.reserveChannelsLive，调用时将返回 not supported                         |
| `restartMiniProgram`                          | `restartMiniProgram`                          | ❌   | 未提供 my.restartMiniProgram，调用时将返回 not supported                          |
| `revokeBufferURL`                             | `revokeBufferURL`                             | ❌   | 未提供 my.revokeBufferURL，调用时将返回 not supported                             |
| `rewriteRoute`                                | `rewriteRoute`                                | ❌   | 未提供 my.rewriteRoute，调用时将返回 not supported                                |
| `saveFileToDisk`                              | `saveFileToDisk`                              | ✅   | 直连 `my.saveFileToDisk`                                                          |
| `saveImageToPhotosAlbum`                      | `saveImageToPhotosAlbum`                      | ✅   | 直连 `my.saveImageToPhotosAlbum`                                                  |
| `saveVideoToPhotosAlbum`                      | `saveVideoToPhotosAlbum`                      | ✅   | 直连 `my.saveVideoToPhotosAlbum`                                                  |
| `scanCode`                                    | `scanCode`                                    | ❌   | 未提供 my.scanCode，调用时将返回 not supported                                    |
| `seekBackgroundAudio`                         | `seekBackgroundAudio`                         | ❌   | 未提供 my.seekBackgroundAudio，调用时将返回 not supported                         |
| `selectGroupMembers`                          | `selectGroupMembers`                          | ❌   | 未提供 my.selectGroupMembers，调用时将返回 not supported                          |
| `sendHCEMessage`                              | `sendHCEMessage`                              | ❌   | 未提供 my.sendHCEMessage，调用时将返回 not supported                              |
| `sendSms`                                     | `sendSms`                                     | ❌   | 未提供 my.sendSms，调用时将返回 not supported                                     |
| `sendSocketMessage`                           | `sendSocketMessage`                           | ✅   | 直连 `my.sendSocketMessage`                                                       |
| `setBackgroundColor`                          | `setBackgroundColor`                          | ✅   | 直连 `my.setBackgroundColor`                                                      |
| `setBackgroundFetchToken`                     | `setBackgroundFetchToken`                     | ❌   | 未提供 my.setBackgroundFetchToken，调用时将返回 not supported                     |
| `setBackgroundTextStyle`                      | `setBackgroundTextStyle`                      | ✅   | 直连 `my.setBackgroundTextStyle`                                                  |
| `setBLEMTU`                                   | `setBLEMTU`                                   | ✅   | 直连 `my.setBLEMTU`                                                               |
| `setClipboardData`                            | `setClipboard`                                | ✅   | 转调 `my.setClipboard` 并映射 `data` → `text`                                     |
| `setEnable1v1Chat`                            | `setEnable1v1Chat`                            | ❌   | 未提供 my.setEnable1v1Chat，调用时将返回 not supported                            |
| `setEnableDebug`                              | `setEnableDebug`                              | ❌   | 未提供 my.setEnableDebug，调用时将返回 not supported                              |
| `setInnerAudioOption`                         | `setInnerAudioOption`                         | ❌   | 未提供 my.setInnerAudioOption，调用时将返回 not supported                         |
| `setKeepScreenOn`                             | `setKeepScreenOn`                             | ✅   | 直连 `my.setKeepScreenOn`                                                         |
| `setNavigationBarColor`                       | `setNavigationBarColor`                       | ✅   | 直连 `my.setNavigationBarColor`                                                   |
| `setNavigationBarTitle`                       | `setNavigationBarTitle`                       | ✅   | 直连 `my.setNavigationBarTitle`                                                   |
| `setScreenBrightness`                         | `setScreenBrightness`                         | ✅   | 直连 `my.setScreenBrightness`                                                     |
| `setStorage`                                  | `setStorage`                                  | ✅   | 直连 `my.setStorage`                                                              |
| `setStorageSync`                              | `setStorageSync`                              | ✅   | 直连 `my.setStorageSync`                                                          |
| `setTabBarBadge`                              | `setTabBarBadge`                              | ✅   | 直连 `my.setTabBarBadge`                                                          |
| `setTabBarItem`                               | `setTabBarItem`                               | ✅   | 直连 `my.setTabBarItem`                                                           |
| `setTabBarStyle`                              | `setTabBarStyle`                              | ✅   | 直连 `my.setTabBarStyle`                                                          |
| `setTopBarText`                               | `setTopBarText`                               | ❌   | 未提供 my.setTopBarText，调用时将返回 not supported                               |
| `setVisualEffectOnCapture`                    | `setVisualEffectOnCapture`                    | ✅   | 直连 `my.setVisualEffectOnCapture`                                                |
| `setWifiList`                                 | `setWifiList`                                 | ✅   | 直连 `my.setWifiList`                                                             |
| `setWindowSize`                               | `setWindowSize`                               | ❌   | 未提供 my.setWindowSize，调用时将返回 not supported                               |
| `shareAppMessageToGroup`                      | `shareAppMessageToGroup`                      | ❌   | 未提供 my.shareAppMessageToGroup，调用时将返回 not supported                      |
| `shareEmojiToGroup`                           | `shareEmojiToGroup`                           | ❌   | 未提供 my.shareEmojiToGroup，调用时将返回 not supported                           |
| `shareFileMessage`                            | `shareFileMessage`                            | ❌   | 未提供 my.shareFileMessage，调用时将返回 not supported                            |
| `shareFileToGroup`                            | `shareFileToGroup`                            | ❌   | 未提供 my.shareFileToGroup，调用时将返回 not supported                            |
| `shareImageToGroup`                           | `shareImageToGroup`                           | ❌   | 未提供 my.shareImageToGroup，调用时将返回 not supported                           |
| `shareToOfficialAccount`                      | `shareToOfficialAccount`                      | ❌   | 未提供 my.shareToOfficialAccount，调用时将返回 not supported                      |
| `shareToWeRun`                                | `shareToWeRun`                                | ❌   | 未提供 my.shareToWeRun，调用时将返回 not supported                                |
| `shareVideoMessage`                           | `shareVideoMessage`                           | ❌   | 未提供 my.shareVideoMessage，调用时将返回 not supported                           |
| `shareVideoToGroup`                           | `shareVideoToGroup`                           | ❌   | 未提供 my.shareVideoToGroup，调用时将返回 not supported                           |
| `showActionSheet`                             | `showActionSheet`                             | ✅   | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐                               |
| `showLoading`                                 | `showLoading`                                 | ✅   | `title` 映射到 `content` 后调用 `my.showLoading`                                  |
| `showModal`                                   | `confirm`                                     | ✅   | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果                                  |
| `showNavigationBarLoading`                    | `showNavigationBarLoading`                    | ✅   | 直连 `my.showNavigationBarLoading`                                                |
| `showRedPackage`                              | `showRedPackage`                              | ❌   | 未提供 my.showRedPackage，调用时将返回 not supported                              |
| `showShareImageMenu`                          | `showShareImageMenu`                          | ❌   | 未提供 my.showShareImageMenu，调用时将返回 not supported                          |
| `showShareMenu`                               | `showShareMenu`                               | ✅   | 直连 `my.showShareMenu`                                                           |
| `showTabBar`                                  | `showTabBar`                                  | ✅   | 直连 `my.showTabBar`                                                              |
| `showTabBarRedDot`                            | `showTabBarRedDot`                            | ✅   | 直连 `my.showTabBarRedDot`                                                        |
| `showToast`                                   | `showToast`                                   | ✅   | `title/icon` 映射到 `content/type` 后调用 `my.showToast`                          |
| `startAccelerometer`                          | `startAccelerometer`                          | ✅   | 直连 `my.startAccelerometer`                                                      |
| `startBeaconDiscovery`                        | `startBeaconDiscovery`                        | ✅   | 直连 `my.startBeaconDiscovery`                                                    |
| `startBluetoothDevicesDiscovery`              | `startBluetoothDevicesDiscovery`              | ✅   | 直连 `my.startBluetoothDevicesDiscovery`                                          |
| `startCompass`                                | `startCompass`                                | ✅   | 直连 `my.startCompass`                                                            |
| `startDeviceMotionListening`                  | `startDeviceMotionListening`                  | ❌   | 未提供 my.startDeviceMotionListening，调用时将返回 not supported                  |
| `startGyroscope`                              | `startGyroscope`                              | ✅   | 直连 `my.startGyroscope`                                                          |
| `startHCE`                                    | `startHCE`                                    | ❌   | 未提供 my.startHCE，调用时将返回 not supported                                    |
| `startLocalServiceDiscovery`                  | `startLocalServiceDiscovery`                  | ❌   | 未提供 my.startLocalServiceDiscovery，调用时将返回 not supported                  |
| `startLocationUpdate`                         | `startLocationUpdate`                         | ❌   | 未提供 my.startLocationUpdate，调用时将返回 not supported                         |
| `startLocationUpdateBackground`               | `startLocationUpdateBackground`               | ❌   | 未提供 my.startLocationUpdateBackground，调用时将返回 not supported               |
| `startPullDownRefresh`                        | `startPullDownRefresh`                        | ✅   | 直连 `my.startPullDownRefresh`                                                    |
| `startRecord`                                 | `startRecord`                                 | ❌   | 未提供 my.startRecord，调用时将返回 not supported                                 |
| `startSoterAuthentication`                    | `startSoterAuthentication`                    | ❌   | 未提供 my.startSoterAuthentication，调用时将返回 not supported                    |
| `startWifi`                                   | `startWifi`                                   | ✅   | 直连 `my.startWifi`                                                               |
| `stopAccelerometer`                           | `stopAccelerometer`                           | ✅   | 直连 `my.stopAccelerometer`                                                       |
| `stopBackgroundAudio`                         | `stopBackgroundAudio`                         | ❌   | 未提供 my.stopBackgroundAudio，调用时将返回 not supported                         |
| `stopBeaconDiscovery`                         | `stopBeaconDiscovery`                         | ✅   | 直连 `my.stopBeaconDiscovery`                                                     |
| `stopBluetoothDevicesDiscovery`               | `stopBluetoothDevicesDiscovery`               | ✅   | 直连 `my.stopBluetoothDevicesDiscovery`                                           |
| `stopCompass`                                 | `stopCompass`                                 | ✅   | 直连 `my.stopCompass`                                                             |
| `stopDeviceMotionListening`                   | `stopDeviceMotionListening`                   | ❌   | 未提供 my.stopDeviceMotionListening，调用时将返回 not supported                   |
| `stopFaceDetect`                              | `stopFaceDetect`                              | ❌   | 未提供 my.stopFaceDetect，调用时将返回 not supported                              |
| `stopGyroscope`                               | `stopGyroscope`                               | ✅   | 直连 `my.stopGyroscope`                                                           |
| `stopHCE`                                     | `stopHCE`                                     | ❌   | 未提供 my.stopHCE，调用时将返回 not supported                                     |
| `stopLocalServiceDiscovery`                   | `stopLocalServiceDiscovery`                   | ❌   | 未提供 my.stopLocalServiceDiscovery，调用时将返回 not supported                   |
| `stopLocationUpdate`                          | `stopLocationUpdate`                          | ❌   | 未提供 my.stopLocationUpdate，调用时将返回 not supported                          |
| `stopPullDownRefresh`                         | `stopPullDownRefresh`                         | ✅   | 直连 `my.stopPullDownRefresh`                                                     |
| `stopRecord`                                  | `stopRecord`                                  | ❌   | 未提供 my.stopRecord，调用时将返回 not supported                                  |
| `stopVoice`                                   | `stopVoice`                                   | ❌   | 未提供 my.stopVoice，调用时将返回 not supported                                   |
| `stopWifi`                                    | `stopWifi`                                    | ✅   | 直连 `my.stopWifi`                                                                |
| `subscribeVoIPVideoMembers`                   | `subscribeVoIPVideoMembers`                   | ❌   | 未提供 my.subscribeVoIPVideoMembers，调用时将返回 not supported                   |
| `switchTab`                                   | `switchTab`                                   | ✅   | 直连 `my.switchTab`                                                               |
| `updateShareMenu`                             | `updateShareMenu`                             | ❌   | 未提供 my.updateShareMenu，调用时将返回 not supported                             |
| `updateVoIPChatMuteConfig`                    | `updateVoIPChatMuteConfig`                    | ❌   | 未提供 my.updateVoIPChatMuteConfig，调用时将返回 not supported                    |
| `updateWeChatApp`                             | `updateWeChatApp`                             | ❌   | 未提供 my.updateWeChatApp，调用时将返回 not supported                             |
| `uploadFile`                                  | `uploadFile`                                  | ✅   | 直连 `my.uploadFile`                                                              |
| `vibrateLong`                                 | `vibrateLong`                                 | ✅   | 直连 `my.vibrateLong`                                                             |
| `vibrateShort`                                | `vibrateShort`                                | ✅   | 直连 `my.vibrateShort`                                                            |
| `writeBLECharacteristicValue`                 | `writeBLECharacteristicValue`                 | ✅   | 直连 `my.writeBLECharacteristicValue`                                             |
