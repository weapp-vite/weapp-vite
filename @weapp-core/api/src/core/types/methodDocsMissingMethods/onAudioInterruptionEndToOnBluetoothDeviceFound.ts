import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOnAudioInterruptionEndToOnBluetoothDeviceFound {
  /**
   * 对应微信小程序 `wx.onAudioInterruptionEnd` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAudioInterruptionEnd.html
   *
   * 说明：
   * - 用于监听音频打断结束事件，适合在来电、系统播报或其他媒体占用结束后恢复播放状态。
   * - 常见于音频播放器、课程内容、语音消息等场景，用来决定是否自动续播或提示用户恢复。
   * - 是否自动恢复应由业务结合当前播放状态和用户意图判断，不建议无条件强制续播。
   *
   * 示例：
   * ```ts
   * wpi.onAudioInterruptionEnd(() => {
   *   console.log('audio interruption ended')
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAudioInterruptionEnd')` 与 `wpi.supports('onAudioInterruptionEnd')` 判断。
   */
  onAudioInterruptionEnd: WeapiCrossPlatformAdapter['onAudioInterruptionEnd']

  /**
   * 对应微信小程序 `wx.onBLECharacteristicValueChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLECharacteristicValueChange.html
   *
   * 说明：
   * - 用于监听 BLE 特征值通知，适合接收设备主动上报的数据、状态字或传感器流。
   * - 常见于硬件配网、蓝牙称重、血压计、门锁、打印机等需要实时接收设备消息的场景。
   * - 由于回调频率可能较高，建议在监听里尽量做轻量解析，再把结果分发给业务层。
   *
   * 示例：
   * ```ts
   * wpi.onBLECharacteristicValueChange((event) => {
   *   console.log(event.deviceId, event.value)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBLECharacteristicValueChange')` 与 `wpi.supports('onBLECharacteristicValueChange')` 判断。
   */
  onBLECharacteristicValueChange: WeapiCrossPlatformAdapter['onBLECharacteristicValueChange']

  /**
   * 对应微信小程序 `wx.onBLEMTUChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLEMTUChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBLEMTUChange')` 与 `wpi.supports('onBLEMTUChange')` 判断。
   */
  onBLEMTUChange: WeapiCrossPlatformAdapter['onBLEMTUChange']

  /**
   * 对应微信小程序 `wx.onBLEPeripheralConnectionStateChanged` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.onBLEPeripheralConnectionStateChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBLEPeripheralConnectionStateChanged')` 与 `wpi.supports('onBLEPeripheralConnectionStateChanged')` 判断。
   */
  onBLEPeripheralConnectionStateChanged: WeapiCrossPlatformAdapter['onBLEPeripheralConnectionStateChanged']

  /**
   * 对应微信小程序 `wx.onBackgroundAudioPause` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.onBackgroundAudioPause.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBackgroundAudioPause')` 与 `wpi.supports('onBackgroundAudioPause')` 判断。
   */
  onBackgroundAudioPause: WeapiCrossPlatformAdapter['onBackgroundAudioPause']

  /**
   * 对应微信小程序 `wx.onBackgroundAudioPlay` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.onBackgroundAudioPlay.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBackgroundAudioPlay')` 与 `wpi.supports('onBackgroundAudioPlay')` 判断。
   */
  onBackgroundAudioPlay: WeapiCrossPlatformAdapter['onBackgroundAudioPlay']

  /**
   * 对应微信小程序 `wx.onBackgroundAudioStop` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.onBackgroundAudioStop.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBackgroundAudioStop')` 与 `wpi.supports('onBackgroundAudioStop')` 判断。
   */
  onBackgroundAudioStop: WeapiCrossPlatformAdapter['onBackgroundAudioStop']

  /**
   * 对应微信小程序 `wx.onBackgroundFetchData` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.onBackgroundFetchData.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBackgroundFetchData')` 与 `wpi.supports('onBackgroundFetchData')` 判断。
   */
  onBackgroundFetchData: WeapiCrossPlatformAdapter['onBackgroundFetchData']

  /**
   * 对应微信小程序 `wx.onBatteryInfoChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.onBatteryInfoChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBatteryInfoChange')` 与 `wpi.supports('onBatteryInfoChange')` 判断。
   */
  onBatteryInfoChange: WeapiCrossPlatformAdapter['onBatteryInfoChange']

  /**
   * 对应微信小程序 `wx.onBeaconServiceChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.onBeaconServiceChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBeaconServiceChange')` 与 `wpi.supports('onBeaconServiceChange')` 判断。
   */
  onBeaconServiceChange: WeapiCrossPlatformAdapter['onBeaconServiceChange']

  /**
   * 对应微信小程序 `wx.onBeaconUpdate` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.onBeaconUpdate.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBeaconUpdate')` 与 `wpi.supports('onBeaconUpdate')` 判断。
   */
  onBeaconUpdate: WeapiCrossPlatformAdapter['onBeaconUpdate']

  /**
   * 对应微信小程序 `wx.onBeforeAppRoute` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onBeforeAppRoute.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBeforeAppRoute')` 与 `wpi.supports('onBeforeAppRoute')` 判断。
   */
  onBeforeAppRoute: WeapiCrossPlatformAdapter['onBeforeAppRoute']

  /**
   * 对应微信小程序 `wx.onBeforePageLoad` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onBeforePageLoad.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBeforePageLoad')` 与 `wpi.supports('onBeforePageLoad')` 判断。
   */
  onBeforePageLoad: WeapiCrossPlatformAdapter['onBeforePageLoad']

  /**
   * 对应微信小程序 `wx.onBeforePageUnload` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onBeforePageUnload.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBeforePageUnload')` 与 `wpi.supports('onBeforePageUnload')` 判断。
   */
  onBeforePageUnload: WeapiCrossPlatformAdapter['onBeforePageUnload']

  /**
   * 对应微信小程序 `wx.onBluetoothAdapterStateChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.onBluetoothAdapterStateChange.html
   *
   * 说明：
   * - 用于监听蓝牙模块可用状态和扫描状态变化，适合统一驱动蓝牙入口 UI 与异常提示。
   * - 常见于蓝牙主页、设备搜索页，在系统关闭蓝牙或扫描结束时同步更新界面状态。
   * - 若应用里多个模块依赖蓝牙，建议集中管理该监听，避免多个页面重复注册。
   *
   * 示例：
   * ```ts
   * wpi.onBluetoothAdapterStateChange((event) => {
   *   console.log(event.available, event.discovering)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBluetoothAdapterStateChange')` 与 `wpi.supports('onBluetoothAdapterStateChange')` 判断。
   */
  onBluetoothAdapterStateChange: WeapiCrossPlatformAdapter['onBluetoothAdapterStateChange']

  /**
   * 对应微信小程序 `wx.onBluetoothDeviceFound` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.onBluetoothDeviceFound.html
   *
   * 说明：
   * - 用于监听附近蓝牙设备发现事件，适合设备搜索页、配对流程和周边硬件选择场景。
   * - 一般在调用 `startBluetoothDevicesDiscovery` 后注册，用于持续接收扫描过程中发现的新设备。
   * - 回调可能多次返回同一设备，业务侧应基于 `deviceId` 去重后再渲染列表。
   *
   * 示例：
   * ```ts
   * wpi.onBluetoothDeviceFound((event) => {
   *   console.log(event.devices)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onBluetoothDeviceFound')` 与 `wpi.supports('onBluetoothDeviceFound')` 判断。
   */
  onBluetoothDeviceFound: WeapiCrossPlatformAdapter['onBluetoothDeviceFound']
}
