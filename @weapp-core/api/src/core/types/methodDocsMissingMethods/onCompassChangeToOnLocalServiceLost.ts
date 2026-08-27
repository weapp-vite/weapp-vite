import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOnCompassChangeToOnLocalServiceLost {
  /**
   * 对应微信小程序 `wx.onCompassChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.onCompassChange.html
   *
   * 说明：
   * - 用于监听电子罗盘方向变化，适合指南针、AR 导航、方位提示等依赖朝向信息的场景。
   * - 一般需要先开启罗盘能力，再在页面存活期间订阅回调并在退出时取消监听。
   * - 罗盘数据易受磁场环境影响，业务上应准备校准提示或平滑处理逻辑。
   *
   * 示例：
   * ```ts
   * wpi.onCompassChange((event) => {
   *   console.log(event.direction)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onCompassChange')` 与 `wpi.supports('onCompassChange')` 判断。
   */
  onCompassChange: WeapiCrossPlatformAdapter['onCompassChange']

  /**
   * 对应微信小程序 `wx.onCopyUrl` 的 API。
   *
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.onCopyUrl.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onCopyUrl')` 与 `wpi.supports('onCopyUrl')` 判断。
   */
  onCopyUrl: WeapiCrossPlatformAdapter['onCopyUrl']

  /**
   * 对应微信小程序 `wx.onDeviceMotionChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.onDeviceMotionChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onDeviceMotionChange')` 与 `wpi.supports('onDeviceMotionChange')` 判断。
   */
  onDeviceMotionChange: WeapiCrossPlatformAdapter['onDeviceMotionChange']

  /**
   * 对应微信小程序 `wx.onEmbeddedMiniProgramHeightChange` 的 API。
   *
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.onEmbeddedMiniProgramHeightChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onEmbeddedMiniProgramHeightChange')` 与 `wpi.supports('onEmbeddedMiniProgramHeightChange')` 判断。
   */
  onEmbeddedMiniProgramHeightChange: WeapiCrossPlatformAdapter['onEmbeddedMiniProgramHeightChange']

  /**
   * 对应微信小程序 `wx.onError` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onError.html
   *
   * 说明：
   * - 用于监听脚本错误、资源异常等全局级运行错误，适合做统一告警与问题回溯。
   * - 这类回调通常只提供错误摘要，结合页面路由、设备信息和最近操作日志一起上报更有价值。
   * - 不应把它当作业务异常处理主流程，而应作为兜底监控入口。
   *
   * 示例：
   * ```ts
   * wpi.onError((message) => {
   *   console.error(message)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onError')` 与 `wpi.supports('onError')` 判断。
   */
  onError: WeapiCrossPlatformAdapter['onError']

  /**
   * 对应微信小程序 `wx.onGeneratePoster` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.onGeneratePoster.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onGeneratePoster')` 与 `wpi.supports('onGeneratePoster')` 判断。
   */
  onGeneratePoster: WeapiCrossPlatformAdapter['onGeneratePoster']

  /**
   * 对应微信小程序 `wx.onGetWifiList` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onGetWifiList.html
   *
   * 说明：
   * - 用于监听附近 Wi-Fi 列表获取结果，适合硬件配网、网络选择或信号展示场景。
   * - 常与 `startWifi`、`getWifiList` 配合使用，在回调里渲染可选网络列表。
   * - 不同系统返回的热点数量与字段完整性可能不同，业务上应对空列表和权限失败做兜底。
   *
   * 示例：
   * ```ts
   * wpi.onGetWifiList((event) => {
   *   console.log(event.wifiList)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onGetWifiList')` 与 `wpi.supports('onGetWifiList')` 判断。
   */
  onGetWifiList: WeapiCrossPlatformAdapter['onGetWifiList']

  /**
   * 对应微信小程序 `wx.onGyroscopeChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.onGyroscopeChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onGyroscopeChange')` 与 `wpi.supports('onGyroscopeChange')` 判断。
   */
  onGyroscopeChange: WeapiCrossPlatformAdapter['onGyroscopeChange']

  /**
   * 对应微信小程序 `wx.onHCEMessage` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.onHCEMessage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onHCEMessage')` 与 `wpi.supports('onHCEMessage')` 判断。
   */
  onHCEMessage: WeapiCrossPlatformAdapter['onHCEMessage']

  /**
   * 对应微信小程序 `wx.onKeyDown` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.onKeyDown.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onKeyDown')` 与 `wpi.supports('onKeyDown')` 判断。
   */
  onKeyDown: WeapiCrossPlatformAdapter['onKeyDown']

  /**
   * 对应微信小程序 `wx.onKeyUp` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.onKeyUp.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onKeyUp')` 与 `wpi.supports('onKeyUp')` 判断。
   */
  onKeyUp: WeapiCrossPlatformAdapter['onKeyUp']

  /**
   * 对应微信小程序 `wx.onKeyboardHeightChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.onKeyboardHeightChange.html
   *
   * 说明：
   * - 用于监听软键盘高度变化，适合聊天输入框跟随、底部工具栏避让和表单滚动修正。
   * - 常见于键盘弹起时重新计算安全区域或底部定位样式，避免输入区被遮挡。
   * - 高度变化频繁时应避免在回调里执行过重计算，防止输入体验抖动。
   *
   * 示例：
   * ```ts
   * wpi.onKeyboardHeightChange((event) => {
   *   console.log(event.height)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onKeyboardHeightChange')` 与 `wpi.supports('onKeyboardHeightChange')` 判断。
   */
  onKeyboardHeightChange: WeapiCrossPlatformAdapter['onKeyboardHeightChange']

  /**
   * 对应微信小程序 `wx.onLazyLoadError` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onLazyLoadError.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLazyLoadError')` 与 `wpi.supports('onLazyLoadError')` 判断。
   */
  onLazyLoadError: WeapiCrossPlatformAdapter['onLazyLoadError']

  /**
   * 对应微信小程序 `wx.onLocalServiceDiscoveryStop` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceDiscoveryStop.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLocalServiceDiscoveryStop')` 与 `wpi.supports('onLocalServiceDiscoveryStop')` 判断。
   */
  onLocalServiceDiscoveryStop: WeapiCrossPlatformAdapter['onLocalServiceDiscoveryStop']

  /**
   * 对应微信小程序 `wx.onLocalServiceFound` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceFound.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLocalServiceFound')` 与 `wpi.supports('onLocalServiceFound')` 判断。
   */
  onLocalServiceFound: WeapiCrossPlatformAdapter['onLocalServiceFound']

  /**
   * 对应微信小程序 `wx.onLocalServiceLost` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceLost.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onLocalServiceLost')` 与 `wpi.supports('onLocalServiceLost')` 判断。
   */
  onLocalServiceLost: WeapiCrossPlatformAdapter['onLocalServiceLost']
}
