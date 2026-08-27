import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOnLocalServiceResolveFailToOnSocketOpen {
  /**
   * 对应微信小程序 `wx.onLocalServiceResolveFail` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceResolveFail.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLocalServiceResolveFail')` 与 `wpi.supports('onLocalServiceResolveFail')` 判断。
   */
  onLocalServiceResolveFail: WeapiCrossPlatformAdapter['onLocalServiceResolveFail']

  /**
   * 对应微信小程序 `wx.onLocationChange` 的 API。
   *
   * 分类：位置
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.onLocationChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLocationChange')` 与 `wpi.supports('onLocationChange')` 判断。
   */
  onLocationChange: WeapiCrossPlatformAdapter['onLocationChange']

  /**
   * 对应微信小程序 `wx.onLocationChangeError` 的 API。
   *
   * 分类：位置
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.onLocationChangeError.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLocationChangeError')` 与 `wpi.supports('onLocationChangeError')` 判断。
   */
  onLocationChangeError: WeapiCrossPlatformAdapter['onLocationChangeError']

  /**
   * 对应微信小程序 `wx.onMemoryWarning` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/memory/wx.onMemoryWarning.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onMemoryWarning')` 与 `wpi.supports('onMemoryWarning')` 判断。
   */
  onMemoryWarning: WeapiCrossPlatformAdapter['onMemoryWarning']

  /**
   * 对应微信小程序 `wx.onMenuButtonBoundingClientRectWeightChange` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/menu/wx.onMenuButtonBoundingClientRectWeightChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onMenuButtonBoundingClientRectWeightChange')` 与 `wpi.supports('onMenuButtonBoundingClientRectWeightChange')` 判断。
   */
  onMenuButtonBoundingClientRectWeightChange: WeapiCrossPlatformAdapter['onMenuButtonBoundingClientRectWeightChange']

  /**
   * 对应微信小程序 `wx.onNeedPrivacyAuthorization` 的 API。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.onNeedPrivacyAuthorization.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onNeedPrivacyAuthorization')` 与 `wpi.supports('onNeedPrivacyAuthorization')` 判断。
   */
  onNeedPrivacyAuthorization: WeapiCrossPlatformAdapter['onNeedPrivacyAuthorization']

  /**
   * 对应微信小程序 `wx.onNetworkStatusChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.onNetworkStatusChange.html
   *
   * 说明：
   * - 用于监听网络连接变化，适合断网提醒、自动重试或弱网降级处理。
   * - 使用后应在合适的生命周期里解绑，避免页面多次进入时重复注册。
   *
   * 示例：
   * ```ts
   * wpi.onNetworkStatusChange((event) => {
   *   console.log(event.isConnected, event.networkType)
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onNetworkStatusChange')` 与 `wpi.supports('onNetworkStatusChange')` 判断。
   */
  onNetworkStatusChange: WeapiCrossPlatformAdapter['onNetworkStatusChange']

  /**
   * 对应微信小程序 `wx.onNetworkWeakChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.onNetworkWeakChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onNetworkWeakChange')` 与 `wpi.supports('onNetworkWeakChange')` 判断。
   */
  onNetworkWeakChange: WeapiCrossPlatformAdapter['onNetworkWeakChange']

  /**
   * 对应微信小程序 `wx.onPageNotFound` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onPageNotFound.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onPageNotFound')` 与 `wpi.supports('onPageNotFound')` 判断。
   */
  onPageNotFound: WeapiCrossPlatformAdapter['onPageNotFound']

  /**
   * 对应微信小程序 `wx.onParallelStateChange` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.onParallelStateChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onParallelStateChange')` 与 `wpi.supports('onParallelStateChange')` 判断。
   */
  onParallelStateChange: WeapiCrossPlatformAdapter['onParallelStateChange']

  /**
   * 对应微信小程序 `wx.onScreenRecordingStateChanged` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.onScreenRecordingStateChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onScreenRecordingStateChanged')` 与 `wpi.supports('onScreenRecordingStateChanged')` 判断。
   */
  onScreenRecordingStateChanged: WeapiCrossPlatformAdapter['onScreenRecordingStateChanged']

  /**
   * 对应微信小程序 `wx.onSocketClose` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketClose.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onSocketClose')` 与 `wpi.supports('onSocketClose')` 判断。
   */
  onSocketClose: WeapiCrossPlatformAdapter['onSocketClose']

  /**
   * 对应微信小程序 `wx.onSocketError` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketError.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onSocketError')` 与 `wpi.supports('onSocketError')` 判断。
   */
  onSocketError: WeapiCrossPlatformAdapter['onSocketError']

  /**
   * 对应微信小程序 `wx.onSocketMessage` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketMessage.html
   *
   * 说明：
   * - 用于监听 WebSocket 服务端推送消息。
   * - 建议业务侧对消息格式做统一解包，例如 JSON.parse 与事件分发，不要把原始消息散落到各页面中处理。
   *
   * 示例：
   * ```ts
   * wpi.onSocketMessage((event) => {
   *   console.log(event.data)
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onSocketMessage')` 与 `wpi.supports('onSocketMessage')` 判断。
   */
  onSocketMessage: WeapiCrossPlatformAdapter['onSocketMessage']

  /**
   * 对应微信小程序 `wx.onSocketOpen` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketOpen.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onSocketOpen')` 与 `wpi.supports('onSocketOpen')` 判断。
   */
  onSocketOpen: WeapiCrossPlatformAdapter['onSocketOpen']
}
