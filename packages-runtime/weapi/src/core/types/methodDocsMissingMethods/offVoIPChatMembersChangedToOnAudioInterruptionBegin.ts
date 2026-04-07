import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOffVoIPChatMembersChangedToOnAudioInterruptionBegin {
  /**
   * 对应微信小程序 `wx.offVoIPChatMembersChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatMembersChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offVoIPChatMembersChanged')` 与 `wpi.supports('offVoIPChatMembersChanged')` 判断。
   */
  offVoIPChatMembersChanged: WeapiCrossPlatformAdapter['offVoIPChatMembersChanged']

  /**
   * 对应微信小程序 `wx.offVoIPChatSpeakersChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatSpeakersChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offVoIPChatSpeakersChanged')` 与 `wpi.supports('offVoIPChatSpeakersChanged')` 判断。
   */
  offVoIPChatSpeakersChanged: WeapiCrossPlatformAdapter['offVoIPChatSpeakersChanged']

  /**
   * 对应微信小程序 `wx.offVoIPChatStateChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatStateChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offVoIPChatStateChanged')` 与 `wpi.supports('offVoIPChatStateChanged')` 判断。
   */
  offVoIPChatStateChanged: WeapiCrossPlatformAdapter['offVoIPChatStateChanged']

  /**
   * 对应微信小程序 `wx.offVoIPVideoMembersChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPVideoMembersChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offVoIPVideoMembersChanged')` 与 `wpi.supports('offVoIPVideoMembersChanged')` 判断。
   */
  offVoIPVideoMembersChanged: WeapiCrossPlatformAdapter['offVoIPVideoMembersChanged']

  /**
   * 对应微信小程序 `wx.offWifiConnected` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.offWifiConnected.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offWifiConnected')` 与 `wpi.supports('offWifiConnected')` 判断。
   */
  offWifiConnected: WeapiCrossPlatformAdapter['offWifiConnected']

  /**
   * 对应微信小程序 `wx.offWifiConnectedWithPartialInfo` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.offWifiConnectedWithPartialInfo.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offWifiConnectedWithPartialInfo')` 与 `wpi.supports('offWifiConnectedWithPartialInfo')` 判断。
   */
  offWifiConnectedWithPartialInfo: WeapiCrossPlatformAdapter['offWifiConnectedWithPartialInfo']

  /**
   * 对应微信小程序 `wx.offWindowStateChange` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.offWindowStateChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offWindowStateChange')` 与 `wpi.supports('offWindowStateChange')` 判断。
   */
  offWindowStateChange: WeapiCrossPlatformAdapter['offWindowStateChange']

  /**
   * 对应微信小程序 `wx.onAccelerometerChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.onAccelerometerChange.html
   *
   * 说明：
   * - 用于监听加速度传感器数据变化，适合体感交互、摇一摇、运动反馈等场景。
   * - 事件频率较高，业务侧应避免在回调里执行重计算或频繁 setData。
   *
   * 示例：
   * ```ts
   * wpi.onAccelerometerChange((event) => {
   *   console.log(event.x, event.y, event.z)
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAccelerometerChange')` 与 `wpi.supports('onAccelerometerChange')` 判断。
   */
  onAccelerometerChange: WeapiCrossPlatformAdapter['onAccelerometerChange']

  /**
   * 对应微信小程序 `wx.onAfterPageLoad` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAfterPageLoad.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAfterPageLoad')` 与 `wpi.supports('onAfterPageLoad')` 判断。
   */
  onAfterPageLoad: WeapiCrossPlatformAdapter['onAfterPageLoad']

  /**
   * 对应微信小程序 `wx.onAfterPageUnload` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAfterPageUnload.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAfterPageUnload')` 与 `wpi.supports('onAfterPageUnload')` 判断。
   */
  onAfterPageUnload: WeapiCrossPlatformAdapter['onAfterPageUnload']

  /**
   * 对应微信小程序 `wx.onApiCategoryChange` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.onApiCategoryChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onApiCategoryChange')` 与 `wpi.supports('onApiCategoryChange')` 判断。
   */
  onApiCategoryChange: WeapiCrossPlatformAdapter['onApiCategoryChange']

  /**
   * 对应微信小程序 `wx.onAppHide` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAppHide.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAppHide')` 与 `wpi.supports('onAppHide')` 判断。
   */
  onAppHide: WeapiCrossPlatformAdapter['onAppHide']

  /**
   * 对应微信小程序 `wx.onAppRoute` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAppRoute.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAppRoute')` 与 `wpi.supports('onAppRoute')` 判断。
   */
  onAppRoute: WeapiCrossPlatformAdapter['onAppRoute']

  /**
   * 对应微信小程序 `wx.onAppRouteDone` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAppRouteDone.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAppRouteDone')` 与 `wpi.supports('onAppRouteDone')` 判断。
   */
  onAppRouteDone: WeapiCrossPlatformAdapter['onAppRouteDone']

  /**
   * 对应微信小程序 `wx.onAppShow` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAppShow.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAppShow')` 与 `wpi.supports('onAppShow')` 判断。
   */
  onAppShow: WeapiCrossPlatformAdapter['onAppShow']

  /**
   * 对应微信小程序 `wx.onAudioInterruptionBegin` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAudioInterruptionBegin.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onAudioInterruptionBegin')` 与 `wpi.supports('onAudioInterruptionBegin')` 判断。
   */
  onAudioInterruptionBegin: WeapiCrossPlatformAdapter['onAudioInterruptionBegin']
}
