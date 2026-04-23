# 01 Overview

## 覆盖结论

- 小程序基准命名方法总数：484
- 支付宝可调用兼容方法数：201
- 支付宝语义对齐方法数：201
- 支付宝 fallback 方法数：0
- 抖音可调用兼容方法数：133
- 抖音语义对齐方法数：133
- 抖音 fallback 方法数：0
- 三端可调用完全对齐方法数：117
- 三端语义完全对齐方法数：117
- 三端命名交集方法数（miniProgram∩my∩tt）：112
- 三端命名交集可调用完全对齐方法数：112
- 三端命名交集可调用覆盖率：100.00%
- 三端命名交集语义完全对齐方法数：112
- 三端命名交集语义对齐覆盖率：100.00%

## 不兼容规模

- 支付宝侧不兼容（按小程序基准命名调用失败）方法：283
- 抖音侧不兼容（按小程序基准命名调用失败）方法：351

## 不兼容示例（前 40 项）

### 支付宝不兼容示例

- `addCard` -> 目标 `addCard`（unsupported）
- `addFileToFavorites` -> 目标 `addFileToFavorites`（unsupported）
- `addPaymentPassFinish` -> 目标 `addPaymentPassFinish`（unsupported）
- `addPaymentPassGetCertificateData` -> 目标 `addPaymentPassGetCertificateData`（unsupported）
- `addPhoneCalendar` -> 目标 `addPhoneCalendar`（unsupported）
- `addPhoneRepeatCalendar` -> 目标 `addPhoneRepeatCalendar`（unsupported）
- `addVideoToFavorites` -> 目标 `addVideoToFavorites`（unsupported）
- `authorize` -> 目标 `authorize`（unsupported）
- `authorizeForMiniProgram` -> 目标 `authorizeForMiniProgram`（unsupported）
- `authPrivateMessage` -> 目标 `authPrivateMessage`（unsupported）
- `batchGetStorage` -> 目标 `batchGetStorage`（unsupported）
- `batchGetStorageSync` -> 目标 `batchGetStorageSync`（unsupported）
- `batchSetStorage` -> 目标 `batchSetStorage`（unsupported）
- `batchSetStorageSync` -> 目标 `batchSetStorageSync`（unsupported）
- `bindEmployeeRelation` -> 目标 `bindEmployeeRelation`（unsupported）
- `canAddSecureElementPass` -> 目标 `canAddSecureElementPass`（unsupported）
- `cancelIdleCallback` -> 目标 `cancelIdleCallback`（unsupported）
- `canvasGetImageData` -> 目标 `canvasGetImageData`（unsupported）
- `canvasPutImageData` -> 目标 `canvasPutImageData`（unsupported）
- `checkDeviceSupportHevc` -> 目标 `checkDeviceSupportHevc`（unsupported）
- `checkEmployeeRelation` -> 目标 `checkEmployeeRelation`（unsupported）
- `checkIsAddedToMyMiniProgram` -> 目标 `checkIsAddedToMyMiniProgram`（unsupported）
- `checkIsOpenAccessibility` -> 目标 `checkIsOpenAccessibility`（unsupported）
- `checkIsPictureInPictureActive` -> 目标 `checkIsPictureInPictureActive`（unsupported）
- `checkIsSupportFacialRecognition` -> 目标 `checkIsSupportFacialRecognition`（unsupported）
- `checkSession` -> 目标 `checkSession`（unsupported）
- `chooseAddress` -> 目标 `chooseAddress`（unsupported）
- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`（unsupported）
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`（unsupported）
- `chooseMedia` -> 目标 `chooseMedia`（unsupported）
- `chooseMessageFile` -> 目标 `chooseMessageFile`（unsupported）
- `choosePoi` -> 目标 `choosePoi`（unsupported）
- `compressVideo` -> 目标 `compressVideo`（unsupported）
- `createAudioContext` -> 目标 `createAudioContext`（unsupported）
- `createBLEPeripheralServer` -> 目标 `createBLEPeripheralServer`（unsupported）
- `createBufferURL` -> 目标 `createBufferURL`（unsupported）
- `createCacheManager` -> 目标 `createCacheManager`（unsupported）
- `createCameraContext` -> 目标 `createCameraContext`（unsupported）
- `createGlobalPayment` -> 目标 `createGlobalPayment`（unsupported）

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
- `batchGetStorage` -> 目标 `batchGetStorage`（unsupported）
- `batchGetStorageSync` -> 目标 `batchGetStorageSync`（unsupported）
- `batchSetStorage` -> 目标 `batchSetStorage`（unsupported）
- `batchSetStorageSync` -> 目标 `batchSetStorageSync`（unsupported）
- `bindEmployeeRelation` -> 目标 `bindEmployeeRelation`（unsupported）
- `canAddSecureElementPass` -> 目标 `canAddSecureElementPass`（unsupported）
- `cancelIdleCallback` -> 目标 `cancelIdleCallback`（unsupported）
- `canvasGetImageData` -> 目标 `canvasGetImageData`（unsupported）
- `canvasPutImageData` -> 目标 `canvasPutImageData`（unsupported）
- `checkDeviceSupportHevc` -> 目标 `checkDeviceSupportHevc`（unsupported）
- `checkEmployeeRelation` -> 目标 `checkEmployeeRelation`（unsupported）
- `checkIsAddedToMyMiniProgram` -> 目标 `checkIsAddedToMyMiniProgram`（unsupported）
- `checkIsOpenAccessibility` -> 目标 `checkIsOpenAccessibility`（unsupported）
- `checkIsPictureInPictureActive` -> 目标 `checkIsPictureInPictureActive`（unsupported）
- `checkIsSoterEnrolledInDevice` -> 目标 `checkIsSoterEnrolledInDevice`（unsupported）
- `checkIsSupportFacialRecognition` -> 目标 `checkIsSupportFacialRecognition`（unsupported）
- `checkIsSupportSoterAuthentication` -> 目标 `checkIsSupportSoterAuthentication`（unsupported）
- `chooseContact` -> 目标 `chooseContact`（unsupported）
- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`（unsupported）
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`（unsupported）
- `chooseMessageFile` -> 目标 `chooseMessageFile`（unsupported）
- `choosePoi` -> 目标 `choosePoi`（unsupported）
- `chooseVideo` -> 目标 `chooseVideo`（unsupported）
- `closeBLEConnection` -> 目标 `closeBLEConnection`（unsupported）
- `closeBluetoothAdapter` -> 目标 `closeBluetoothAdapter`（unsupported）
- `closeSocket` -> 目标 `closeSocket`（unsupported）
- `compressVideo` -> 目标 `compressVideo`（unsupported）
- `connectWifi` -> 目标 `connectWifi`（unsupported）
- `createAudioContext` -> 目标 `createAudioContext`（unsupported）
