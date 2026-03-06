# 01 Overview

## 覆盖结论

- 微信基准命名方法总数：479
- 支付宝兼容方法数：207
- 抖音兼容方法数：145
- 三端完全对齐方法数：133

## 不兼容规模

- 支付宝侧不兼容（按微信命名调用失败）方法：272
- 抖音侧不兼容（按微信命名调用失败）方法：334

## 不兼容示例（前 40 项）

### 支付宝不兼容示例

- `addCard` -> 目标 `addCard`
- `addFileToFavorites` -> 目标 `addFileToFavorites`
- `addPaymentPassFinish` -> 目标 `addPaymentPassFinish`
- `addPaymentPassGetCertificateData` -> 目标 `addPaymentPassGetCertificateData`
- `addPhoneCalendar` -> 目标 `addPhoneCalendar`
- `addPhoneRepeatCalendar` -> 目标 `addPhoneRepeatCalendar`
- `addVideoToFavorites` -> 目标 `addVideoToFavorites`
- `authorize` -> 目标 `authorize`
- `authorizeForMiniProgram` -> 目标 `authorizeForMiniProgram`
- `authPrivateMessage` -> 目标 `authPrivateMessage`
- `batchGetStorage` -> 目标 `batchGetStorage`
- `batchGetStorageSync` -> 目标 `batchGetStorageSync`
- `batchSetStorage` -> 目标 `batchSetStorage`
- `batchSetStorageSync` -> 目标 `batchSetStorageSync`
- `bindEmployeeRelation` -> 目标 `bindEmployeeRelation`
- `canAddSecureElementPass` -> 目标 `canAddSecureElementPass`
- `cancelIdleCallback` -> 目标 `cancelIdleCallback`
- `canvasGetImageData` -> 目标 `canvasGetImageData`
- `canvasPutImageData` -> 目标 `canvasPutImageData`
- `checkDeviceSupportHevc` -> 目标 `checkDeviceSupportHevc`
- `checkEmployeeRelation` -> 目标 `checkEmployeeRelation`
- `checkIsAddedToMyMiniProgram` -> 目标 `checkIsAddedToMyMiniProgram`
- `checkIsOpenAccessibility` -> 目标 `checkIsOpenAccessibility`
- `checkIsPictureInPictureActive` -> 目标 `checkIsPictureInPictureActive`
- `checkIsSoterEnrolledInDevice` -> 目标 `checkIsSoterEnrolledInDevice`
- `checkIsSupportSoterAuthentication` -> 目标 `checkIsSupportSoterAuthentication`
- `checkSession` -> 目标 `checkSession`
- `chooseInvoice` -> 目标 `chooseInvoice`
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`
- `chooseMedia` -> 目标 `chooseMedia`
- `chooseMessageFile` -> 目标 `chooseMessageFile`
- `choosePoi` -> 目标 `choosePoi`
- `closeBLEConnection` -> 目标 `closeBLEConnection`
- `compressVideo` -> 目标 `compressVideo`
- `createBLEConnection` -> 目标 `createBLEConnection`
- `createBLEPeripheralServer` -> 目标 `createBLEPeripheralServer`
- `createBufferURL` -> 目标 `createBufferURL`
- `createCacheManager` -> 目标 `createCacheManager`
- `createCameraContext` -> 目标 `createCameraContext`

### 抖音不兼容示例

- `addCard` -> 目标 `addCard`
- `addFileToFavorites` -> 目标 `addFileToFavorites`
- `addPaymentPassFinish` -> 目标 `addPaymentPassFinish`
- `addPaymentPassGetCertificateData` -> 目标 `addPaymentPassGetCertificateData`
- `addPhoneCalendar` -> 目标 `addPhoneCalendar`
- `addPhoneContact` -> 目标 `addPhoneContact`
- `addPhoneRepeatCalendar` -> 目标 `addPhoneRepeatCalendar`
- `addVideoToFavorites` -> 目标 `addVideoToFavorites`
- `authorizeForMiniProgram` -> 目标 `authorizeForMiniProgram`
- `authPrivateMessage` -> 目标 `authPrivateMessage`
- `batchGetStorage` -> 目标 `batchGetStorage`
- `batchGetStorageSync` -> 目标 `batchGetStorageSync`
- `batchSetStorage` -> 目标 `batchSetStorage`
- `batchSetStorageSync` -> 目标 `batchSetStorageSync`
- `bindEmployeeRelation` -> 目标 `bindEmployeeRelation`
- `canAddSecureElementPass` -> 目标 `canAddSecureElementPass`
- `cancelIdleCallback` -> 目标 `cancelIdleCallback`
- `canvasGetImageData` -> 目标 `canvasGetImageData`
- `canvasPutImageData` -> 目标 `canvasPutImageData`
- `checkDeviceSupportHevc` -> 目标 `checkDeviceSupportHevc`
- `checkEmployeeRelation` -> 目标 `checkEmployeeRelation`
- `checkIsAddedToMyMiniProgram` -> 目标 `checkIsAddedToMyMiniProgram`
- `checkIsOpenAccessibility` -> 目标 `checkIsOpenAccessibility`
- `checkIsPictureInPictureActive` -> 目标 `checkIsPictureInPictureActive`
- `checkIsSoterEnrolledInDevice` -> 目标 `checkIsSoterEnrolledInDevice`
- `checkIsSupportSoterAuthentication` -> 目标 `checkIsSupportSoterAuthentication`
- `chooseContact` -> 目标 `chooseContact`
- `chooseInvoice` -> 目标 `chooseInvoice`
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`
- `chooseMessageFile` -> 目标 `chooseMessageFile`
- `choosePoi` -> 目标 `choosePoi`
- `chooseVideo` -> 目标 `chooseVideo`
- `closeBLEConnection` -> 目标 `closeBLEConnection`
- `closeBluetoothAdapter` -> 目标 `closeBluetoothAdapter`
- `closeSocket` -> 目标 `closeSocket`
- `compressVideo` -> 目标 `compressVideo`
- `connectWifi` -> 目标 `connectWifi`
- `createBLEConnection` -> 目标 `createBLEConnection`
- `createBLEPeripheralServer` -> 目标 `createBLEPeripheralServer`
