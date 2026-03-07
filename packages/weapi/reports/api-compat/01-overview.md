# 01 Overview

## 覆盖结论

- 微信基准命名方法总数：479
- 支付宝可调用兼容方法数：370
- 支付宝语义对齐方法数：370
- 支付宝 fallback 方法数：0
- 抖音可调用兼容方法数：308
- 抖音语义对齐方法数：308
- 抖音 fallback 方法数：0
- 三端可调用完全对齐方法数：306
- 三端语义完全对齐方法数：306

## 不兼容规模

- 支付宝侧不兼容（按微信命名调用失败）方法：109
- 抖音侧不兼容（按微信命名调用失败）方法：171

## 不兼容示例（前 40 项）

### 支付宝不兼容示例

- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `chooseInvoiceTitle` -> 目标 `chooseInvoiceTitle`（unsupported）
- `chooseLicensePlate` -> 目标 `chooseLicensePlate`（unsupported）
- `choosePoi` -> 目标 `choosePoi`（unsupported）
- `closeBLEConnection` -> 目标 `closeBLEConnection`（unsupported）
- `compressVideo` -> 目标 `compressVideo`（unsupported）
- `createBLEConnection` -> 目标 `createBLEConnection`（unsupported）
- `cropImage` -> 目标 `cropImage`（unsupported）
- `editImage` -> 目标 `editImage`（unsupported）
- `exitVoIPChat` -> 目标 `exitVoIPChat`（unsupported）
- `faceDetect` -> 目标 `faceDetect`（unsupported）
- `getApiCategory` -> 目标 `getApiCategory`（unsupported）
- `getBackgroundFetchToken` -> 目标 `getBackgroundFetchToken`（unsupported）
- `getChannelsLiveInfo` -> 目标 `getChannelsLiveInfo`（unsupported）
- `getChannelsLiveNoticeInfo` -> 目标 `getChannelsLiveNoticeInfo`（unsupported）
- `getChannelsShareKey` -> 目标 `getChannelsShareKey`（unsupported）
- `getChatToolInfo` -> 目标 `getChatToolInfo`（unsupported）
- `getCommonConfig` -> 目标 `getCommonConfig`（unsupported）
- `getExptInfoSync` -> 目标 `getExptInfoSync`（unsupported）
- `getGroupEnterInfo` -> 目标 `getGroupEnterInfo`（unsupported）
- `getPrivacySetting` -> 目标 `getPrivacySetting`（unsupported）
- `getShareInfo` -> 目标 `getShareInfo`（unsupported）
- `getSkylineInfoSync` -> 目标 `getSkylineInfoSync`（unsupported）
- `initFaceDetect` -> 目标 `initFaceDetect`（unsupported）
- `join1v1Chat` -> 目标 `join1v1Chat`（unsupported）
- `joinVoIPChat` -> 目标 `joinVoIPChat`（unsupported）
- `offAfterPageLoad` -> 目标 `offAfterPageLoad`（unsupported）
- `offAfterPageUnload` -> 目标 `offAfterPageUnload`（unsupported）
- `offApiCategoryChange` -> 目标 `offApiCategoryChange`（unsupported）
- `offAppRoute` -> 目标 `offAppRoute`（unsupported）
- `offAppRouteDone` -> 目标 `offAppRouteDone`（unsupported）
- `offBatteryInfoChange` -> 目标 `offBatteryInfoChange`（unsupported）
- `offBeforeAppRoute` -> 目标 `offBeforeAppRoute`（unsupported）
- `offBeforePageLoad` -> 目标 `offBeforePageLoad`（unsupported）
- `offBeforePageUnload` -> 目标 `offBeforePageUnload`（unsupported）
- `offBLEMTUChange` -> 目标 `offBLEMTUChange`（unsupported）
- `offBLEPeripheralConnectionStateChanged` -> 目标 `offBLEPeripheralConnectionStateChanged`（unsupported）
- `offCopyUrl` -> 目标 `offCopyUrl`（unsupported）
- `offEmbeddedMiniProgramHeightChange` -> 目标 `offEmbeddedMiniProgramHeightChange`（unsupported）
- `offGeneratePoster` -> 目标 `offGeneratePoster`（unsupported）

### 抖音不兼容示例

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
- `cropImage` -> 目标 `cropImage`（unsupported）
- `disableAlertBeforeUnload` -> 目标 `disableAlertBeforeUnload`（unsupported）
- `editImage` -> 目标 `editImage`（unsupported）
- `enableAlertBeforeUnload` -> 目标 `enableAlertBeforeUnload`（unsupported）
- `exitVoIPChat` -> 目标 `exitVoIPChat`（unsupported）
- `faceDetect` -> 目标 `faceDetect`（unsupported）
- `getApiCategory` -> 目标 `getApiCategory`（unsupported）
- `getAvailableAudioSources` -> 目标 `getAvailableAudioSources`（unsupported）
- `getBackgroundFetchData` -> 目标 `getBackgroundFetchData`（unsupported）
- `getBackgroundFetchToken` -> 目标 `getBackgroundFetchToken`（unsupported）
- `getBeacons` -> 目标 `getBeacons`（unsupported）
- `getBLEDeviceCharacteristics` -> 目标 `getBLEDeviceCharacteristics`（unsupported）
- `getBLEDeviceRSSI` -> 目标 `getBLEDeviceRSSI`（unsupported）
- `getBLEDeviceServices` -> 目标 `getBLEDeviceServices`（unsupported）
- `getBLEMTU` -> 目标 `getBLEMTU`（unsupported）
- `getBluetoothAdapterState` -> 目标 `getBluetoothAdapterState`（unsupported）
- `getBluetoothDevices` -> 目标 `getBluetoothDevices`（unsupported）
- `getChannelsLiveInfo` -> 目标 `getChannelsLiveInfo`（unsupported）
- `getChannelsLiveNoticeInfo` -> 目标 `getChannelsLiveNoticeInfo`（unsupported）
- `getChannelsShareKey` -> 目标 `getChannelsShareKey`（unsupported）
- `getChatToolInfo` -> 目标 `getChatToolInfo`（unsupported）
- `getCommonConfig` -> 目标 `getCommonConfig`（unsupported）
- `getConnectedBluetoothDevices` -> 目标 `getConnectedBluetoothDevices`（unsupported）
- `getExptInfoSync` -> 目标 `getExptInfoSync`（unsupported）
- `getGroupEnterInfo` -> 目标 `getGroupEnterInfo`（unsupported）
- `getLocalIPAddress` -> 目标 `getLocalIPAddress`（unsupported）
- `getPrivacySetting` -> 目标 `getPrivacySetting`（unsupported）
- `getShareInfo` -> 目标 `getShareInfo`（unsupported）
- `getSkylineInfoSync` -> 目标 `getSkylineInfoSync`（unsupported）
