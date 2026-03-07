# 01 Overview

## 覆盖结论

- 微信基准命名方法总数：479
- 支付宝可调用兼容方法数：247
- 支付宝语义对齐方法数：247
- 支付宝 fallback 方法数：0
- 抖音可调用兼容方法数：184
- 抖音语义对齐方法数：184
- 抖音 fallback 方法数：0
- 三端可调用完全对齐方法数：182
- 三端语义完全对齐方法数：182

## 不兼容规模

- 支付宝侧不兼容（按微信命名调用失败）方法：232
- 抖音侧不兼容（按微信命名调用失败）方法：295

## 不兼容示例（前 40 项）

### 支付宝不兼容示例

- `addCard` -> 目标 `addCard`（unsupported）
- `addFileToFavorites` -> 目标 `addFileToFavorites`（unsupported）
- `addPaymentPassFinish` -> 目标 `addPaymentPassFinish`（unsupported）
- `addPaymentPassGetCertificateData` -> 目标 `addPaymentPassGetCertificateData`（unsupported）
- `addPhoneCalendar` -> 目标 `addPhoneCalendar`（unsupported）
- `addPhoneRepeatCalendar` -> 目标 `addPhoneRepeatCalendar`（unsupported）
- `addVideoToFavorites` -> 目标 `addVideoToFavorites`（unsupported）
- `authorizeForMiniProgram` -> 目标 `authorizeForMiniProgram`（unsupported）
- `authPrivateMessage` -> 目标 `authPrivateMessage`（unsupported）
- `bindEmployeeRelation` -> 目标 `bindEmployeeRelation`（unsupported）
- `canAddSecureElementPass` -> 目标 `canAddSecureElementPass`（unsupported）
- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`（unsupported）
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`（unsupported）
- `choosePoi` -> 目标 `choosePoi`（unsupported）
- `closeBLEConnection` -> 目标 `closeBLEConnection`（unsupported）
- `compressVideo` -> 目标 `compressVideo`（unsupported）
- `createBLEConnection` -> 目标 `createBLEConnection`（unsupported）
- `createBLEPeripheralServer` -> 目标 `createBLEPeripheralServer`（unsupported）
- `createBufferURL` -> 目标 `createBufferURL`（unsupported）
- `createCacheManager` -> 目标 `createCacheManager`（unsupported）
- `createGlobalPayment` -> 目标 `createGlobalPayment`（unsupported）
- `createInferenceSession` -> 目标 `createInferenceSession`（unsupported）
- `createMediaAudioPlayer` -> 目标 `createMediaAudioPlayer`（unsupported）
- `createMediaContainer` -> 目标 `createMediaContainer`（unsupported）
- `createMediaRecorder` -> 目标 `createMediaRecorder`（unsupported）
- `createTCPSocket` -> 目标 `createTCPSocket`（unsupported）
- `createUDPSocket` -> 目标 `createUDPSocket`（unsupported）
- `createVideoDecoder` -> 目标 `createVideoDecoder`（unsupported）
- `cropImage` -> 目标 `cropImage`（unsupported）
- `editImage` -> 目标 `editImage`（unsupported）
- `exitVoIPChat` -> 目标 `exitVoIPChat`（unsupported）
- `faceDetect` -> 目标 `faceDetect`（unsupported）
- `getApiCategory` -> 目标 `getApiCategory`（unsupported）
- `getBackgroundAudioPlayerState` -> 目标 `getBackgroundAudioPlayerState`（unsupported）
- `getBackgroundFetchToken` -> 目标 `getBackgroundFetchToken`（unsupported）
- `getChannelsLiveInfo` -> 目标 `getChannelsLiveInfo`（unsupported）
- `getChannelsLiveNoticeInfo` -> 目标 `getChannelsLiveNoticeInfo`（unsupported）
- `getChannelsShareKey` -> 目标 `getChannelsShareKey`（unsupported）
- `getChatToolInfo` -> 目标 `getChatToolInfo`（unsupported）

### 抖音不兼容示例

- `addCard` -> 目标 `addCard`（unsupported）
- `addFileToFavorites` -> 目标 `addFileToFavorites`（unsupported）
- `addPaymentPassFinish` -> 目标 `addPaymentPassFinish`（unsupported）
- `addPaymentPassGetCertificateData` -> 目标 `addPaymentPassGetCertificateData`（unsupported）
- `addPhoneCalendar` -> 目标 `addPhoneCalendar`（unsupported）
- `addPhoneContact` -> 目标 `addPhoneContact`（unsupported）
- `addPhoneRepeatCalendar` -> 目标 `addPhoneRepeatCalendar`（unsupported）
- `addVideoToFavorites` -> 目标 `addVideoToFavorites`（unsupported）
- `authorizeForMiniProgram` -> 目标 `authorizeForMiniProgram`（unsupported）
- `authPrivateMessage` -> 目标 `authPrivateMessage`（unsupported）
- `bindEmployeeRelation` -> 目标 `bindEmployeeRelation`（unsupported）
- `canAddSecureElementPass` -> 目标 `canAddSecureElementPass`（unsupported）
- `chooseContact` -> 目标 `chooseContact`（unsupported）
- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`（unsupported）
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`（unsupported）
- `choosePoi` -> 目标 `choosePoi`（unsupported）
- `closeBLEConnection` -> 目标 `closeBLEConnection`（unsupported）
- `closeBluetoothAdapter` -> 目标 `closeBluetoothAdapter`（unsupported）
- `closeSocket` -> 目标 `closeSocket`（unsupported）
- `compressVideo` -> 目标 `compressVideo`（unsupported）
- `connectWifi` -> 目标 `connectWifi`（unsupported）
- `createBLEConnection` -> 目标 `createBLEConnection`（unsupported）
- `createBLEPeripheralServer` -> 目标 `createBLEPeripheralServer`（unsupported）
- `createBufferURL` -> 目标 `createBufferURL`（unsupported）
- `createCacheManager` -> 目标 `createCacheManager`（unsupported）
- `createGlobalPayment` -> 目标 `createGlobalPayment`（unsupported）
- `createInferenceSession` -> 目标 `createInferenceSession`（unsupported）
- `createMediaAudioPlayer` -> 目标 `createMediaAudioPlayer`（unsupported）
- `createMediaContainer` -> 目标 `createMediaContainer`（unsupported）
- `createMediaRecorder` -> 目标 `createMediaRecorder`（unsupported）
- `createTCPSocket` -> 目标 `createTCPSocket`（unsupported）
- `createUDPSocket` -> 目标 `createUDPSocket`（unsupported）
- `createVideoDecoder` -> 目标 `createVideoDecoder`（unsupported）
- `cropImage` -> 目标 `cropImage`（unsupported）
- `disableAlertBeforeUnload` -> 目标 `disableAlertBeforeUnload`（unsupported）
- `editImage` -> 目标 `editImage`（unsupported）
- `enableAlertBeforeUnload` -> 目标 `enableAlertBeforeUnload`（unsupported）
- `exitVoIPChat` -> 目标 `exitVoIPChat`（unsupported）
- `faceDetect` -> 目标 `faceDetect`（unsupported）
