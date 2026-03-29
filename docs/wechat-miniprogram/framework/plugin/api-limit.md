<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/api-limit.html -->

# 插件调用 API 的限制

插件可以调用的 API 与小程序不同，主要有两个区别：

- 插件的请求域名列表与小程序相互独立；
- 一些 API 不允许插件调用（这些函数不存在于 `wx` 对象下）。

有些接口虽然在插件中不能使用，但可以通过插件功能页来达到目的，请参考 [插件功能页](./functional-pages.md) 。

各接口在插件中的支持情况可以在各接口的文档中确认，接口文档中会有如 *「本接口从基础库 2.1.0 起支持在小程序插件中使用」* 的标识；如果没有标识，说明插件暂未支持，如果有需要的具体使用场景和需求，可以在开发者社区中反馈。

以下表格汇总了目前插件可以调用的 API 及其对应版本要求， **但这份表格已经不再更新，是否可以使用，请以具体接口文档中的说明和真机表现为准** 。

插件支持接口情况参考汇总（表格已停止维护）

### 基础

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/base/wx.arrayBufferToBase64.html">wx.arrayBufferToBase64</a></td> <td></td> <td></td></tr> <tr><td><a href="../../api/base/wx.base64ToArrayBuffer.html">wx.base64ToArrayBuffer</a></td> <td></td> <td></td></tr></tbody></table>

### 发起请求

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/network/request/wx.request.html">wx.request</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 上传、下载

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/network/download/wx.downloadFile.html">wx.downloadFile</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/network/upload/wx.uploadFile.html">wx.uploadFile</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### WebSocket

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/network/websocket/wx.connectSocket.html">wx.connectSocket</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 图片

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/image/wx.previewImage.html">wx.previewImage</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/image/wx.chooseImage.html">wx.chooseImage</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/image/wx.getImageInfo.html">wx.getImageInfo</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/image/wx.saveImageToPhotosAlbum.html">wx.saveImageToPhotosAlbum</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 录音

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/recorder/wx.startRecord.html">wx.startRecord</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/recorder/wx.stopRecord.html">wx.stopRecord</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 实时音视频

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/live/wx.createLivePlayerContext.html">wx.createLivePlayerContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/live/wx.createLivePusherContext.html">wx.createLivePusherContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 录音管理

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/recorder/wx.getRecorderManager.html">wx.getRecorderManager</a></td> <td><a href="../compatibility.html">1.9.94</a></td> <td></td></tr></tbody></table>

### 音频播放控制

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/audio/wx.pauseVoice.html">wx.pauseVoice</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/audio/wx.playVoice.html">wx.playVoice</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/audio/wx.stopVoice.html">wx.stopVoice</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 音乐播放控制

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/background-audio/wx.onBackgroundAudioPlay.html">wx.onBackgroundAudioPlay</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.getBackgroundAudioPlayerState.html">wx.getBackgroundAudioPlayerState</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.onBackgroundAudioStop.html">wx.onBackgroundAudioStop</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.stopBackgroundAudio.html">wx.stopBackgroundAudio</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.onBackgroundAudioPause.html">wx.onBackgroundAudioPause</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.seekBackgroundAudio.html">wx.seekBackgroundAudio</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.playBackgroundAudio.html">wx.playBackgroundAudio</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/background-audio/wx.pauseBackgroundAudio.html">wx.pauseBackgroundAudio</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 背景音频播放管理

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/background-audio/wx.getBackgroundAudioManager.html">wx.getBackgroundAudioManager</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 音频组件控制

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/audio/wx.createInnerAudioContext.html">wx.createInnerAudioContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/audio/wx.createAudioContext.html">wx.createAudioContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 视频

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/video/wx.chooseVideo.html">wx.chooseVideo</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/media/video/wx.saveVideoToPhotosAlbum.html">wx.saveVideoToPhotosAlbum</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 视频组件控制

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/video/wx.createVideoContext.html">wx.createVideoContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 相机组件控制

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/camera/wx.createCameraContext.html">wx.createCameraContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 数据缓存

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/storage/wx.setStorage.html">wx.setStorage</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/storage/wx.getStorage.html">wx.getStorage</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/storage/wx.removeStorage.html">wx.removeStorage</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/storage/wx.setStorageSync.html">wx.setStorageSync</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/storage/wx.getStorageSync.html">wx.getStorageSync</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/storage/wx.removeStorageSync.html">wx.removeStorageSync</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 获取位置

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/location/wx.getLocation.html">wx.getLocation</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/location/wx.chooseLocation.html">wx.chooseLocation</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/location/wx.onLocationChange.html">wx.onLocationChange</a></td> <td><a href="../compatibility.html">2.8.0</a></td> <td></td></tr> <tr><td><a href="../../api/location/wx.offLocationChange.html">wx.offLocationChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/location/wx.stopLocationUpdate.html">wx.stopLocationUpdate</a></td> <td><a href="../compatibility.html">2.8.0</a></td> <td></td></tr> <tr><td><a href="../../api/location/wx.startLocationUpdate.html">wx.startLocationUpdate</a></td> <td><a href="../compatibility.html">2.8.0</a></td> <td></td></tr></tbody></table>

### 查看位置

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/location/wx.openLocation.html">wx.openLocation</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 地图组件控制

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/media/map/wx.createMapContext.html">wx.createMapContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 系统信息

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/base/system/wx.getSystemInfoSync.html">wx.getSystemInfoSync</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/base/system/wx.getSystemInfo.html">wx.getSystemInfo</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 屏幕亮度

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/screen/wx.setKeepScreenOn.html">wx.setKeepScreenOn</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/screen/wx.setScreenBrightness.html">wx.setScreenBrightness</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/screen/wx.getScreenBrightness.html">wx.getScreenBrightness</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 用户截屏事件

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/screen/wx.onUserCaptureScreen.html">wx.onUserCaptureScreen</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/device/screen/wx.offUserCaptureScreen.html">wx.offUserCaptureScreen</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### 振动

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/vibrate/wx.vibrateLong.html">wx.vibrateLong</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/vibrate/wx.vibrateShort.html">wx.vibrateShort</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 手机联系人

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/contact/wx.addPhoneContact.html">wx.addPhoneContact</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### NFC

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/nfc-hce/wx.sendHCEMessage.html">wx.sendHCEMessage</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td></td></tr> <tr><td><a href="../../api/device/nfc-hce/wx.stopHCE.html">wx.stopHCE</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td></td></tr> <tr><td><a href="../../api/device/nfc-hce/wx.onHCEMessage.html">wx.onHCEMessage</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td></td></tr> <tr><td><a href="../../api/device/nfc-hce/wx.offHCEMessage.html">wx.offHCEMessage</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/nfc-hce/wx.startHCE.html">wx.startHCE</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td></td></tr> <tr><td><a href="../../api/device/nfc-hce/wx.getHCEState.html">wx.getHCEState</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td></td></tr></tbody></table>

### 网络状态

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/network/wx.onNetworkStatusChange.html">wx.onNetworkStatusChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/network/wx.offNetworkStatusChange.html">wx.offNetworkStatusChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/network/wx.getNetworkType.html">wx.getNetworkType</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 加速度计

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/accelerometer/wx.startAccelerometer.html">wx.startAccelerometer</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/accelerometer/wx.stopAccelerometer.html">wx.stopAccelerometer</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/accelerometer/wx.onAccelerometerChange.html">wx.onAccelerometerChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/accelerometer/wx.offAccelerometerChange.html">wx.offAccelerometerChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr></tbody></table>

### 设备方向

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/motion/wx.startDeviceMotionListening.html">wx.startDeviceMotionListening</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/motion/wx.stopDeviceMotionListening.html">wx.stopDeviceMotionListening</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/motion/wx.offDeviceMotionChange.html">wx.offDeviceMotionChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/motion/wx.onDeviceMotionChange.html">wx.onDeviceMotionChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr></tbody></table>

### 陀螺仪

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/gyroscope/wx.startGyroscope.html">wx.startGyroscope</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/gyroscope/wx.stopGyroscope.html">wx.stopGyroscope</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/gyroscope/wx.offGyroscopeChange.html">wx.offGyroscopeChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/gyroscope/wx.onGyroscopeChange.html">wx.onGyroscopeChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr></tbody></table>

### 罗盘

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/compass/wx.onCompassChange.html">wx.onCompassChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/compass/wx.offCompassChange.html">wx.offCompassChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/compass/wx.stopCompass.html">wx.stopCompass</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/compass/wx.startCompass.html">wx.startCompass</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 拨打电话

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/phone/wx.makePhoneCall.html">wx.makePhoneCall</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 扫码

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/scan/wx.scanCode.html">wx.scanCode</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 剪贴板

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/clipboard/wx.setClipboardData.html">wx.setClipboardData</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/clipboard/wx.getClipboardData.html">wx.getClipboardData</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 蓝牙

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/bluetooth-ble/wx.writeBLECharacteristicValue.html">wx.writeBLECharacteristicValue</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.startBluetoothDevicesDiscovery.html">wx.startBluetoothDevicesDiscovery</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.getConnectedBluetoothDevices.html">wx.getConnectedBluetoothDevices</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html">wx.notifyBLECharacteristicValueChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.onBluetoothDeviceFound.html">wx.onBluetoothDeviceFound</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.offBluetoothDeviceFound.html">wx.offBluetoothDeviceFound</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.readBLECharacteristicValue.html">wx.readBLECharacteristicValue</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.openBluetoothAdapter.html">wx.openBluetoothAdapter</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.getBLEDeviceCharacteristics.html">wx.getBLEDeviceCharacteristics</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.stopBluetoothDevicesDiscovery.html">wx.stopBluetoothDevicesDiscovery</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.onBLEConnectionStateChange.html">wx.onBLEConnectionStateChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.getBluetoothDevices.html">wx.getBluetoothDevices</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.getBluetoothAdapterState.html">wx.getBluetoothAdapterState</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.onBluetoothAdapterStateChange.html">wx.onBluetoothAdapterStateChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.offBluetoothAdapterStateChange.html">wx.offBluetoothAdapterStateChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.getBLEDeviceServices.html">wx.getBLEDeviceServices</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.onBLECharacteristicValueChange.html">wx.onBLECharacteristicValueChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.offBLECharacteristicValueChange.html">wx.offBLECharacteristicValueChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.createBLEConnection.html">wx.createBLEConnection</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth/wx.closeBluetoothAdapter.html">wx.closeBluetoothAdapter</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.closeBLEConnection.html">wx.closeBLEConnection</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html">wx.notifyBLECharacteristicValueChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.onBLEConnectionStateChange.html">wx.onBLEConnectionStateChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/bluetooth-ble/wx.offBLEConnectionStateChange.html">wx.offBLEConnectionStateChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr></tbody></table>

### iBeacon

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/ibeacon/wx.getBeacons.html">wx.getBeacons</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/ibeacon/wx.startBeaconDiscovery.html">wx.startBeaconDiscovery</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/ibeacon/wx.onBeaconServiceChange.html">wx.onBeaconServiceChange</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/ibeacon/wx.offBeaconServiceChange.html">wx.offBeaconServiceChange</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/ibeacon/wx.onBeaconUpdate.html">wx.onBeaconUpdate</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/device/ibeacon/wx.offBeaconUpdate.html">wx.offBeaconUpdate</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/ibeacon/wx.stopBeaconDiscovery.html">wx.stopBeaconDiscovery</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### Wi-Fi

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/device/wifi/wx.connectWifi.html">wx.connectWifi</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.getConnectedWifi.html">wx.getConnectedWifi</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.getWifiList.html">wx.getWifiList</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.offGetWifiList.html">wx.offGetWifiList</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.offWifiConnected.html">wx.offWifiConnected</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="(wx.onEvaluateWifi)">wx.onEvaluateWifi</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.onGetWifiList.html">wx.onGetWifiList</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.onWifiConnected.html">wx.onWifiConnected</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="(wx.presetWifiList)">wx.presetWifiList</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.setWifiList.html">wx.setWifiList</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.startWifi.html">wx.startWifi</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr> <tr><td><a href="../../api/device/wifi/wx.stopWifi.html">wx.stopWifi</a></td> <td><a href="../compatibility.html">2.9.1</a></td> <td></td></tr></tbody></table>

### 交互反馈

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/ui/interaction/wx.hideLoading.html">wx.hideLoading</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/ui/interaction/wx.showActionSheet.html">wx.showActionSheet</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/ui/interaction/wx.showLoading.html">wx.showLoading</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/ui/interaction/wx.hideToast.html">wx.hideToast</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/ui/interaction/wx.showToast.html">wx.showToast</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/ui/interaction/wx.showModal.html">wx.showModal</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 设置导航条

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/ui/navigation-bar/wx.showNavigationBarLoading.html">wx.showNavigationBarLoading</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/ui/navigation-bar/wx.hideNavigationBarLoading.html">wx.hideNavigationBarLoading</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/ui/navigation-bar/wx.setNavigationBarColor.html">wx.setNavigationBarColor</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/ui/navigation-bar/wx.setNavigationBarTitle.html">wx.setNavigationBarTitle</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### 背景

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/ui/background/wx.setBackgroundColor.html">wx.setBackgroundColor</a></td> <td><a href="../compatibility.html">2.4.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/ui/background/wx.setBackgroundTextStyle.html">wx.setBackgroundTextStyle</a></td> <td><a href="../compatibility.html">2.4.0</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### WXML 节点信息

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/wxml/wx.createSelectorQuery.html">wx.createSelectorQuery</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### WXML 节点布局相交状态

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/wxml/wx.createIntersectionObserver.html">wx.createIntersectionObserver</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 导航

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/route/wx.navigateBack.html">wx.navigateBack</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/route/wx.navigateTo.html">wx.navigateTo</a></td> <td><a href="../compatibility.html">2.2.2</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/route/wx.redirectTo.html">wx.redirectTo</a></td> <td><a href="../compatibility.html">2.2.2</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/route/wx.switchTab.html">wx.switchTab</a></td> <td><a href="../compatibility.html">2.3.1</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/route/wx.reLaunch.html">wx.reLaunch</a></td> <td><a href="../compatibility.html">2.3.1</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### 动画

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/ui/animation/wx.createAnimation.html">wx.createAnimation</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 位置

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/ui/scroll/wx.pageScrollTo.html">wx.pageScrollTo</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### 绘图

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/canvas/wx.createOffscreenCanvas.html">wx.createOffscreenCanvas</a></td> <td><a href="../compatibility.html">2.7.1</a></td> <td></td></tr> <tr><td><a href="../../api/canvas/wx.canvasPutImageData.html">wx.canvasPutImageData</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/canvas/wx.canvasToTempFilePath.html">wx.canvasToTempFilePath</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/canvas/wx.createCanvasContext.html">wx.createCanvasContext</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr> <tr><td><a href="../../api/canvas/wx.canvasGetImageData.html">wx.canvasGetImageData</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td></td></tr></tbody></table>

### 下拉刷新

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/ui/pull-down-refresh/wx.stopPullDownRefresh.html">wx.stopPullDownRefresh</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/ui/pull-down-refresh/wx.startPullDownRefresh.html">wx.startPullDownRefresh</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### 当前账号信息

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/open-api/account-info/wx.getAccountInfoSync.html">wx.getAccountInfoSync</a></td> <td><a href="../compatibility.html">2.2.2</a></td> <td></td></tr></tbody></table>

### 转发

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/share/wx.hideShareMenu.html">wx.hideShareMenu</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/share/wx.getShareInfo.html">wx.getShareInfo</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/share/wx.showShareMenu.html">wx.showShareMenu</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr> <tr><td><a href="../../api/share/wx.updateShareMenu.html">wx.updateShareMenu</a></td> <td><a href="../compatibility.html">2.1.0</a></td> <td>仅限插件页面中调用</td></tr></tbody></table>

### 实时日志

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/base/debug/wx.getRealtimeLogManager.html">wx.getRealtimeLogManager</a></td> <td><a href="../compatibility.html">2.16.0</a></td> <td></td></tr></tbody></table>

### 其他

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/open-api/setting/wx.getSetting.html">wx.getSetting</a></td> <td><a href="../compatibility.html">2.6.3</a></td> <td></td></tr> <tr><td><a href="../../api/open-api/setting/wx.openSetting.html">wx.openSetting</a></td> <td><a href="../compatibility.html">2.10.3</a></td> <td></td></tr> <tr><td><a href="../../api/data-analysis/wx.reportAnalytics.html">wx.reportAnalytics</a></td> <td><a href="../compatibility.html">1.9.6</a></td> <td>见下方备注</td></tr></tbody></table>

### 登录和获取用户信息

**这一组接口仅限在用户信息功能页中获得用户授权之后调用。否则将返回 fail 。详见 [用户信息功能页](./functional-pages/user-info.md) 。**

<table><thead><tr><th>API</th> <th>最低版本</th> <th>备注</th></tr></thead> <tbody><tr><td><a href="../../api/open-api/login/wx.login.html">wx.login</a></td> <td><a href="../compatibility.html">2.3.1</a></td> <td></td></tr> <tr><td><a href="../../api/open-api/user-info/wx.getUserInfo.html">wx.getUserInfo</a></td> <td><a href="../compatibility.html">2.3.1</a></td> <td></td></tr></tbody></table>

#### Bugs & Tips

- [wx.reportAnalytics](https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportAnalytics.html) 可以被正常调用，但目前不会进行统计展示。
