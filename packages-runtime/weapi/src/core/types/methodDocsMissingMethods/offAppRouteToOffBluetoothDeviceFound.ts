import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOffAppRouteToOffBluetoothDeviceFound {
  /**
   * 对应微信小程序 `wx.offAppRoute` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offAppRoute.html
   *
   * 说明：
   * - 用于移除通过 `onAppRoute` 注册的路由切换监听，避免全局订阅长期残留。
   * - 适合在插件、调试工具或临时诊断逻辑结束后清理监听器，防止重复触发。
   * - 如果业务在多个位置注册了不同回调，应明确传入对应处理函数，避免误删其他监听。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.path)
   * }
   *
   * wpi.onAppRoute(handler)
   * wpi.offAppRoute(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAppRoute')` 与 `wpi.supports('offAppRoute')` 判断。
   */
  offAppRoute: WeapiCrossPlatformAdapter['offAppRoute']

  /**
   * 对应微信小程序 `wx.offAppRouteDone` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offAppRouteDone.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAppRouteDone')` 与 `wpi.supports('offAppRouteDone')` 判断。
   */
  offAppRouteDone: WeapiCrossPlatformAdapter['offAppRouteDone']

  /**
   * 对应微信小程序 `wx.offAppShow` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAppShow.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAppShow')` 与 `wpi.supports('offAppShow')` 判断。
   */
  offAppShow: WeapiCrossPlatformAdapter['offAppShow']

  /**
   * 对应微信小程序 `wx.offAudioInterruptionBegin` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAudioInterruptionBegin.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAudioInterruptionBegin')` 与 `wpi.supports('offAudioInterruptionBegin')` 判断。
   */
  offAudioInterruptionBegin: WeapiCrossPlatformAdapter['offAudioInterruptionBegin']

  /**
   * 对应微信小程序 `wx.offAudioInterruptionEnd` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAudioInterruptionEnd.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAudioInterruptionEnd')` 与 `wpi.supports('offAudioInterruptionEnd')` 判断。
   */
  offAudioInterruptionEnd: WeapiCrossPlatformAdapter['offAudioInterruptionEnd']

  /**
   * 对应微信小程序 `wx.offBLECharacteristicValueChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.offBLECharacteristicValueChange.html
   *
   * 说明：
   * - 用于取消 BLE 特征值变化监听，常见于蓝牙数据读取完成、页面退出或连接关闭后的资源清理。
   * - 长时间保留通知监听容易导致重复回调或状态错乱，蓝牙场景通常应成对使用 `on` / `off`。
   * - 当一个页面绑定多个设备订阅时，建议按回调维度精确解绑，避免误影响其他连接流程。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.value)
   * }
   *
   * wpi.onBLECharacteristicValueChange(handler)
   * wpi.offBLECharacteristicValueChange(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBLECharacteristicValueChange')` 与 `wpi.supports('offBLECharacteristicValueChange')` 判断。
   */
  offBLECharacteristicValueChange: WeapiCrossPlatformAdapter['offBLECharacteristicValueChange']

  /**
   * 对应微信小程序 `wx.offBLEMTUChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.offBLEMTUChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBLEMTUChange')` 与 `wpi.supports('offBLEMTUChange')` 判断。
   */
  offBLEMTUChange: WeapiCrossPlatformAdapter['offBLEMTUChange']

  /**
   * 对应微信小程序 `wx.offBLEPeripheralConnectionStateChanged` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.offBLEPeripheralConnectionStateChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBLEPeripheralConnectionStateChanged')` 与 `wpi.supports('offBLEPeripheralConnectionStateChanged')` 判断。
   */
  offBLEPeripheralConnectionStateChanged: WeapiCrossPlatformAdapter['offBLEPeripheralConnectionStateChanged']

  /**
   * 对应微信小程序 `wx.offBatteryInfoChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.offBatteryInfoChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBatteryInfoChange')` 与 `wpi.supports('offBatteryInfoChange')` 判断。
   */
  offBatteryInfoChange: WeapiCrossPlatformAdapter['offBatteryInfoChange']

  /**
   * 对应微信小程序 `wx.offBeaconServiceChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.offBeaconServiceChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBeaconServiceChange')` 与 `wpi.supports('offBeaconServiceChange')` 判断。
   */
  offBeaconServiceChange: WeapiCrossPlatformAdapter['offBeaconServiceChange']

  /**
   * 对应微信小程序 `wx.offBeaconUpdate` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.offBeaconUpdate.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBeaconUpdate')` 与 `wpi.supports('offBeaconUpdate')` 判断。
   */
  offBeaconUpdate: WeapiCrossPlatformAdapter['offBeaconUpdate']

  /**
   * 对应微信小程序 `wx.offBeforeAppRoute` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offBeforeAppRoute.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBeforeAppRoute')` 与 `wpi.supports('offBeforeAppRoute')` 判断。
   */
  offBeforeAppRoute: WeapiCrossPlatformAdapter['offBeforeAppRoute']

  /**
   * 对应微信小程序 `wx.offBeforePageLoad` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offBeforePageLoad.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBeforePageLoad')` 与 `wpi.supports('offBeforePageLoad')` 判断。
   */
  offBeforePageLoad: WeapiCrossPlatformAdapter['offBeforePageLoad']

  /**
   * 对应微信小程序 `wx.offBeforePageUnload` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offBeforePageUnload.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBeforePageUnload')` 与 `wpi.supports('offBeforePageUnload')` 判断。
   */
  offBeforePageUnload: WeapiCrossPlatformAdapter['offBeforePageUnload']

  /**
   * 对应微信小程序 `wx.offBluetoothAdapterStateChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.offBluetoothAdapterStateChange.html
   *
   * 说明：
   * - 用于取消蓝牙适配器状态变化监听，适合在页面卸载、蓝牙流程结束时清理回调。
   * - 与 `onBluetoothAdapterStateChange` 成对使用时，可以避免多次进入页面后重复收到状态通知。
   * - 如果你的业务依赖全局蓝牙状态中心，解绑时应确认不会影响其他模块的共享监听。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.available, event.discovering)
   * }
   *
   * wpi.onBluetoothAdapterStateChange(handler)
   * wpi.offBluetoothAdapterStateChange(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBluetoothAdapterStateChange')` 与 `wpi.supports('offBluetoothAdapterStateChange')` 判断。
   */
  offBluetoothAdapterStateChange: WeapiCrossPlatformAdapter['offBluetoothAdapterStateChange']

  /**
   * 对应微信小程序 `wx.offBluetoothDeviceFound` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.offBluetoothDeviceFound.html
   *
   * 说明：
   * - 用于取消附近蓝牙设备发现回调，常见于扫描结束、设备已选定或页面退出后的清理步骤。
   * - 蓝牙扫描过程中如果不及时解绑，重复进入流程时可能出现设备列表重复追加的问题。
   * - 建议与 `startBluetoothDevicesDiscovery`、`stopBluetoothDevicesDiscovery` 组合设计完整生命周期。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.devices)
   * }
   *
   * wpi.onBluetoothDeviceFound(handler)
   * wpi.offBluetoothDeviceFound(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offBluetoothDeviceFound')` 与 `wpi.supports('offBluetoothDeviceFound')` 判断。
   */
  offBluetoothDeviceFound: WeapiCrossPlatformAdapter['offBluetoothDeviceFound']
}
