import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOffCompassChangeToOffLocalServiceLost {
  /**
   * 对应微信小程序 `wx.offCompassChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.offCompassChange.html
   *
   * 说明：
   * - 用于移除通过 `onCompassChange` 注册的方向变化监听，避免页面退出后继续收到罗盘回调。
   * - 罗盘、陀螺仪这类高频传感器事件如果不及时解绑，容易造成性能浪费或状态重复刷新。
   * - 若业务里存在多个独立监听器，应按回调维度精确解绑，避免误清理共享逻辑。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.direction)
   * }
   *
   * wpi.onCompassChange(handler)
   * wpi.offCompassChange(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offCompassChange')` 与 `wpi.supports('offCompassChange')` 判断。
   */
  offCompassChange: WeapiCrossPlatformAdapter['offCompassChange']

  /**
   * 对应微信小程序 `wx.offCopyUrl` 的 API。
   *
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.offCopyUrl.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offCopyUrl')` 与 `wpi.supports('offCopyUrl')` 判断。
   */
  offCopyUrl: WeapiCrossPlatformAdapter['offCopyUrl']

  /**
   * 对应微信小程序 `wx.offDeviceMotionChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.offDeviceMotionChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offDeviceMotionChange')` 与 `wpi.supports('offDeviceMotionChange')` 判断。
   */
  offDeviceMotionChange: WeapiCrossPlatformAdapter['offDeviceMotionChange']

  /**
   * 对应微信小程序 `wx.offEmbeddedMiniProgramHeightChange` 的 API。
   *
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.offEmbeddedMiniProgramHeightChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offEmbeddedMiniProgramHeightChange')` 与 `wpi.supports('offEmbeddedMiniProgramHeightChange')` 判断。
   */
  offEmbeddedMiniProgramHeightChange: WeapiCrossPlatformAdapter['offEmbeddedMiniProgramHeightChange']

  /**
   * 对应微信小程序 `wx.offError` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offError.html
   *
   * 说明：
   * - 用于取消全局错误监听，适合在临时调试、埋点探针或局部诊断逻辑结束后释放回调。
   * - 如果错误收集是全局单例能力，解绑前应确认不会影响其他模块共享的监控链路。
   * - 建议与 `onError` 成对管理，避免多次注册导致同一异常被重复上报。
   *
   * 示例：
   * ```ts
   * const handler = (message: string) => {
   *   console.error(message)
   * }
   *
   * wpi.onError(handler)
   * wpi.offError(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offError')` 与 `wpi.supports('offError')` 判断。
   */
  offError: WeapiCrossPlatformAdapter['offError']

  /**
   * 对应微信小程序 `wx.offGeneratePoster` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.offGeneratePoster.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offGeneratePoster')` 与 `wpi.supports('offGeneratePoster')` 判断。
   */
  offGeneratePoster: WeapiCrossPlatformAdapter['offGeneratePoster']

  /**
   * 对应微信小程序 `wx.offGetWifiList` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.offGetWifiList.html
   *
   * 说明：
   * - 用于取消附近 Wi-Fi 列表结果监听，常见于配网流程结束、页面切换或组件卸载后的清理。
   * - 如果反复进入配网页面却不解绑，回调可能被重复注册，导致列表渲染多次触发。
   * - 建议和 `onGetWifiList`、`getWifiList` 组合设计完整生命周期，扫描结束后及时释放监听。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.wifiList)
   * }
   *
   * wpi.onGetWifiList(handler)
   * wpi.offGetWifiList(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offGetWifiList')` 与 `wpi.supports('offGetWifiList')` 判断。
   */
  offGetWifiList: WeapiCrossPlatformAdapter['offGetWifiList']

  /**
   * 对应微信小程序 `wx.offGyroscopeChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.offGyroscopeChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offGyroscopeChange')` 与 `wpi.supports('offGyroscopeChange')` 判断。
   */
  offGyroscopeChange: WeapiCrossPlatformAdapter['offGyroscopeChange']

  /**
   * 对应微信小程序 `wx.offHCEMessage` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.offHCEMessage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offHCEMessage')` 与 `wpi.supports('offHCEMessage')` 判断。
   */
  offHCEMessage: WeapiCrossPlatformAdapter['offHCEMessage']

  /**
   * 对应微信小程序 `wx.offKeyDown` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.offKeyDown.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offKeyDown')` 与 `wpi.supports('offKeyDown')` 判断。
   */
  offKeyDown: WeapiCrossPlatformAdapter['offKeyDown']

  /**
   * 对应微信小程序 `wx.offKeyUp` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.offKeyUp.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offKeyUp')` 与 `wpi.supports('offKeyUp')` 判断。
   */
  offKeyUp: WeapiCrossPlatformAdapter['offKeyUp']

  /**
   * 对应微信小程序 `wx.offKeyboardHeightChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.offKeyboardHeightChange.html
   *
   * 说明：
   * - 用于取消软键盘高度变化监听，适合聊天页、输入面板或弹层销毁时清理订阅。
   * - 键盘高度回调通常驱动布局变化，不解绑容易让隐藏页面仍然执行 UI 计算。
   * - 与 `onKeyboardHeightChange` 成对管理可以避免输入链路出现重复避让或闪动问题。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.height)
   * }
   *
   * wpi.onKeyboardHeightChange(handler)
   * wpi.offKeyboardHeightChange(handler)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offKeyboardHeightChange')` 与 `wpi.supports('offKeyboardHeightChange')` 判断。
   */
  offKeyboardHeightChange: WeapiCrossPlatformAdapter['offKeyboardHeightChange']

  /**
   * 对应微信小程序 `wx.offLazyLoadError` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offLazyLoadError.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offLazyLoadError')` 与 `wpi.supports('offLazyLoadError')` 判断。
   */
  offLazyLoadError: WeapiCrossPlatformAdapter['offLazyLoadError']

  /**
   * 对应微信小程序 `wx.offLocalServiceDiscoveryStop` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceDiscoveryStop.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offLocalServiceDiscoveryStop')` 与 `wpi.supports('offLocalServiceDiscoveryStop')` 判断。
   */
  offLocalServiceDiscoveryStop: WeapiCrossPlatformAdapter['offLocalServiceDiscoveryStop']

  /**
   * 对应微信小程序 `wx.offLocalServiceFound` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceFound.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offLocalServiceFound')` 与 `wpi.supports('offLocalServiceFound')` 判断。
   */
  offLocalServiceFound: WeapiCrossPlatformAdapter['offLocalServiceFound']

  /**
   * 对应微信小程序 `wx.offLocalServiceLost` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceLost.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offLocalServiceLost')` 与 `wpi.supports('offLocalServiceLost')` 判断。
   */
  offLocalServiceLost: WeapiCrossPlatformAdapter['offLocalServiceLost']
}
