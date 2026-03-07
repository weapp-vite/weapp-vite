# 01 Overview

## 覆盖结论

- 微信基准命名方法总数：479
- 支付宝可调用兼容方法数：395
- 支付宝语义对齐方法数：395
- 支付宝 fallback 方法数：0
- 抖音可调用兼容方法数：334
- 抖音语义对齐方法数：334
- 抖音 fallback 方法数：0
- 三端可调用完全对齐方法数：332
- 三端语义完全对齐方法数：332

## 不兼容规模

- 支付宝侧不兼容（按微信命名调用失败）方法：84
- 抖音侧不兼容（按微信命名调用失败）方法：145

## 不兼容示例（前 40 项）

### 支付宝不兼容示例

- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `getExptInfoSync` -> 目标 `getExptInfoSync`（unsupported）
- `getSkylineInfoSync` -> 目标 `getSkylineInfoSync`（unsupported）
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
- `offHCEMessage` -> 目标 `offHCEMessage`（unsupported）
- `offKeyboardHeightChange` -> 目标 `offKeyboardHeightChange`（unsupported）
- `offKeyDown` -> 目标 `offKeyDown`（unsupported）
- `offKeyUp` -> 目标 `offKeyUp`（unsupported）
- `offLazyLoadError` -> 目标 `offLazyLoadError`（unsupported）
- `offLocalServiceDiscoveryStop` -> 目标 `offLocalServiceDiscoveryStop`（unsupported）
- `offLocalServiceFound` -> 目标 `offLocalServiceFound`（unsupported）
- `offLocalServiceLost` -> 目标 `offLocalServiceLost`（unsupported）
- `offLocalServiceResolveFail` -> 目标 `offLocalServiceResolveFail`（unsupported）
- `offLocationChange` -> 目标 `offLocationChange`（unsupported）
- `offLocationChangeError` -> 目标 `offLocationChangeError`（unsupported）
- `offMenuButtonBoundingClientRectWeightChange` -> 目标 `offMenuButtonBoundingClientRectWeightChange`（unsupported）
- `offNetworkWeakChange` -> 目标 `offNetworkWeakChange`（unsupported）
- `offOnUserTriggerTranslation` -> 目标 `offOnUserTriggerTranslation`（unsupported）
- `offParallelStateChange` -> 目标 `offParallelStateChange`（unsupported）
- `offScreenRecordingStateChanged` -> 目标 `offScreenRecordingStateChanged`（unsupported）
- `offThemeChange` -> 目标 `offThemeChange`（unsupported）
- `offVoIPChatInterrupted` -> 目标 `offVoIPChatInterrupted`（unsupported）
- `offVoIPChatMembersChanged` -> 目标 `offVoIPChatMembersChanged`（unsupported）
- `offVoIPChatSpeakersChanged` -> 目标 `offVoIPChatSpeakersChanged`（unsupported）
- `offVoIPChatStateChanged` -> 目标 `offVoIPChatStateChanged`（unsupported）
- `offVoIPVideoMembersChanged` -> 目标 `offVoIPVideoMembersChanged`（unsupported）
- `offWifiConnectedWithPartialInfo` -> 目标 `offWifiConnectedWithPartialInfo`（unsupported）

### 抖音不兼容示例

- `chooseContact` -> 目标 `chooseContact`（unsupported）
- `chooseInvoice` -> 目标 `chooseInvoice`（unsupported）
- `closeBluetoothAdapter` -> 目标 `closeBluetoothAdapter`（unsupported）
- `closeSocket` -> 目标 `closeSocket`（unsupported）
- `connectWifi` -> 目标 `connectWifi`（unsupported）
- `disableAlertBeforeUnload` -> 目标 `disableAlertBeforeUnload`（unsupported）
- `enableAlertBeforeUnload` -> 目标 `enableAlertBeforeUnload`（unsupported）
- `getAvailableAudioSources` -> 目标 `getAvailableAudioSources`（unsupported）
- `getBackgroundFetchData` -> 目标 `getBackgroundFetchData`（unsupported）
- `getBeacons` -> 目标 `getBeacons`（unsupported）
- `getBLEDeviceCharacteristics` -> 目标 `getBLEDeviceCharacteristics`（unsupported）
- `getBLEDeviceRSSI` -> 目标 `getBLEDeviceRSSI`（unsupported）
- `getBLEDeviceServices` -> 目标 `getBLEDeviceServices`（unsupported）
- `getBLEMTU` -> 目标 `getBLEMTU`（unsupported）
- `getBluetoothAdapterState` -> 目标 `getBluetoothAdapterState`（unsupported）
- `getBluetoothDevices` -> 目标 `getBluetoothDevices`（unsupported）
- `getConnectedBluetoothDevices` -> 目标 `getConnectedBluetoothDevices`（unsupported）
- `getExptInfoSync` -> 目标 `getExptInfoSync`（unsupported）
- `getLocalIPAddress` -> 目标 `getLocalIPAddress`（unsupported）
- `getSkylineInfoSync` -> 目标 `getSkylineInfoSync`（unsupported）
- `loadFontFace` -> 目标 `loadFontFace`（unsupported）
- `makeBluetoothPair` -> 目标 `makeBluetoothPair`（unsupported）
- `notifyBLECharacteristicValueChange` -> 目标 `notifyBLECharacteristicValueChange`（unsupported）
- `offAccelerometerChange` -> 目标 `offAccelerometerChange`（unsupported）
- `offAfterPageLoad` -> 目标 `offAfterPageLoad`（unsupported）
- `offAfterPageUnload` -> 目标 `offAfterPageUnload`（unsupported）
- `offApiCategoryChange` -> 目标 `offApiCategoryChange`（unsupported）
- `offAppRoute` -> 目标 `offAppRoute`（unsupported）
- `offAppRouteDone` -> 目标 `offAppRouteDone`（unsupported）
- `offAudioInterruptionBegin` -> 目标 `offAudioInterruptionBegin`（unsupported）
- `offAudioInterruptionEnd` -> 目标 `offAudioInterruptionEnd`（unsupported）
- `offBatteryInfoChange` -> 目标 `offBatteryInfoChange`（unsupported）
- `offBeaconServiceChange` -> 目标 `offBeaconServiceChange`（unsupported）
- `offBeaconUpdate` -> 目标 `offBeaconUpdate`（unsupported）
- `offBeforeAppRoute` -> 目标 `offBeforeAppRoute`（unsupported）
- `offBeforePageLoad` -> 目标 `offBeforePageLoad`（unsupported）
- `offBeforePageUnload` -> 目标 `offBeforePageUnload`（unsupported）
- `offBLECharacteristicValueChange` -> 目标 `offBLECharacteristicValueChange`（unsupported）
- `offBLEConnectionStateChange` -> 目标 `offBLEConnectionStateChange`（unsupported）
- `offBLEMTUChange` -> 目标 `offBLEMTUChange`（unsupported）
