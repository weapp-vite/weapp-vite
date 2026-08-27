import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsOnThemeChangeToOpenSetting {
  /**
   * 对应微信小程序 `wx.onThemeChange` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onThemeChange.html
   *
   * 说明：
   * - 用于监听系统主题切换，例如浅色/深色模式变化。
   * - 适合在自定义主题体系里同步更新页面样式或全局主题状态。
   *
   * 示例：
   * ```ts
   * wpi.onThemeChange((event) => {
   *   console.log(event.theme)
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onThemeChange')` 与 `wpi.supports('onThemeChange')` 判断。
   */
  onThemeChange: WeapiCrossPlatformAdapter['onThemeChange']

  /**
   * 对应微信小程序 `wx.onUnhandledRejection` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onUnhandledRejection.html
   *
   * 说明：
   * - 用于监听未被捕获的 Promise 拒绝事件，适合统一收集异步错误与兜底告警。
   * - 常见于全局错误监控、埋点上报或开发阶段快速定位未处理异步异常。
   * - 该监听更适合作为补充诊断手段，不应替代业务侧显式的 `try/catch` 或 `catch` 处理。
   *
   * 示例：
   * ```ts
   * wpi.onUnhandledRejection((event) => {
   *   console.error(event.reason)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onUnhandledRejection')` 与 `wpi.supports('onUnhandledRejection')` 判断。
   */
  onUnhandledRejection: WeapiCrossPlatformAdapter['onUnhandledRejection']

  /**
   * 对应微信小程序 `wx.onUserCaptureScreen` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.onUserCaptureScreen.html
   *
   * 说明：
   * - 用于监听用户截屏行为，适合敏感信息提示、海报生成引导或内容传播埋点场景。
   * - 一般只应做轻量提示或记录，不建议在监听后执行过重逻辑影响当前交互。
   * - 是否能稳定触发受宿主环境与系统能力影响，业务上不应把它当作强约束安全能力。
   *
   * 示例：
   * ```ts
   * wpi.onUserCaptureScreen(() => {
   *   wpi.showToast({ title: '已截屏', icon: 'none' })
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onUserCaptureScreen')` 与 `wpi.supports('onUserCaptureScreen')` 判断。
   */
  onUserCaptureScreen: WeapiCrossPlatformAdapter['onUserCaptureScreen']

  /**
   * 对应微信小程序 `wx.onUserOffTranslation` 的 API。
   *
   * 分类：微信
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/onUserOffTranslation.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onUserOffTranslation')` 与 `wpi.supports('onUserOffTranslation')` 判断。
   */
  onUserOffTranslation: WeapiCrossPlatformAdapter['onUserOffTranslation']

  /**
   * 对应微信小程序 `wx.onUserTriggerTranslation` 的 API。
   *
   * 分类：微信
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/onUserTriggerTranslation.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onUserTriggerTranslation')` 与 `wpi.supports('onUserTriggerTranslation')` 判断。
   */
  onUserTriggerTranslation: WeapiCrossPlatformAdapter['onUserTriggerTranslation']

  /**
   * 对应微信小程序 `wx.onVoIPChatInterrupted` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatInterrupted.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onVoIPChatInterrupted')` 与 `wpi.supports('onVoIPChatInterrupted')` 判断。
   */
  onVoIPChatInterrupted: WeapiCrossPlatformAdapter['onVoIPChatInterrupted']

  /**
   * 对应微信小程序 `wx.onVoIPChatMembersChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatMembersChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onVoIPChatMembersChanged')` 与 `wpi.supports('onVoIPChatMembersChanged')` 判断。
   */
  onVoIPChatMembersChanged: WeapiCrossPlatformAdapter['onVoIPChatMembersChanged']

  /**
   * 对应微信小程序 `wx.onVoIPChatSpeakersChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatSpeakersChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onVoIPChatSpeakersChanged')` 与 `wpi.supports('onVoIPChatSpeakersChanged')` 判断。
   */
  onVoIPChatSpeakersChanged: WeapiCrossPlatformAdapter['onVoIPChatSpeakersChanged']

  /**
   * 对应微信小程序 `wx.onVoIPChatStateChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatStateChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onVoIPChatStateChanged')` 与 `wpi.supports('onVoIPChatStateChanged')` 判断。
   */
  onVoIPChatStateChanged: WeapiCrossPlatformAdapter['onVoIPChatStateChanged']

  /**
   * 对应微信小程序 `wx.onVoIPVideoMembersChanged` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPVideoMembersChanged.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onVoIPVideoMembersChanged')` 与 `wpi.supports('onVoIPVideoMembersChanged')` 判断。
   */
  onVoIPVideoMembersChanged: WeapiCrossPlatformAdapter['onVoIPVideoMembersChanged']

  /**
   * 对应微信小程序 `wx.onWifiConnected` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onWifiConnected.html
   *
   * 说明：
   * - 用于监听设备成功连接到 Wi-Fi 的事件，适合硬件配网、局域网初始化与联网成功提示。
   * - 常与 `startWifi`、`connectWifi` 配合使用，在连接成功后继续执行设备发现或接口请求。
   * - 回调触发时机受系统网络栈影响，业务侧仍应结合实际请求结果做最终确认。
   *
   * 示例：
   * ```ts
   * wpi.onWifiConnected((event) => {
   *   console.log(event.wifi)
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onWifiConnected')` 与 `wpi.supports('onWifiConnected')` 判断。
   */
  onWifiConnected: WeapiCrossPlatformAdapter['onWifiConnected']

  /**
   * 对应微信小程序 `wx.onWifiConnectedWithPartialInfo` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onWifiConnectedWithPartialInfo.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onWifiConnectedWithPartialInfo')` 与 `wpi.supports('onWifiConnectedWithPartialInfo')` 判断。
   */
  onWifiConnectedWithPartialInfo: WeapiCrossPlatformAdapter['onWifiConnectedWithPartialInfo']

  /**
   * 对应微信小程序 `wx.onWindowStateChange` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.onWindowStateChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('onWindowStateChange')` 与 `wpi.supports('onWindowStateChange')` 判断。
   */
  onWindowStateChange: WeapiCrossPlatformAdapter['onWindowStateChange']

  /**
   * 对应微信小程序 `wx.openBluetoothAdapter` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html
   *
   * 说明：
   * - 用于初始化蓝牙模块，是扫描设备、建立 BLE 连接前的常见第一步。
   *
   * 示例：
   * ```ts
   * await wpi.openBluetoothAdapter()
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('openBluetoothAdapter')` 与 `wpi.supports('openBluetoothAdapter')` 判断。
   */
  openBluetoothAdapter: WeapiCrossPlatformAdapter['openBluetoothAdapter']

  /**
   * 对应微信小程序 `wx.openLocation` 的 API。
   *
   * 分类：位置
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.openLocation.html
   *
   * 说明：
   * - 用于打开地图位置页展示指定经纬度，适合门店导航、活动地点查看、订单地址跳转等场景。
   * - 通常由业务侧先准备好经纬度、名称与地址信息，再交给宿主地图能力展示。
   * - 当定位信息为空或坐标系不一致时，用户看到的位置可能出现偏差，调用前应确认数据来源。
   *
   * 示例：
   * ```ts
   * await wpi.openLocation({
   *   latitude: 31.23037,
   *   longitude: 121.4737,
   *   name: '上海外滩',
   *   address: '黄浦区中山东一路',
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('openLocation')` 与 `wpi.supports('openLocation')` 判断。
   */
  openLocation: WeapiCrossPlatformAdapter['openLocation']

  /**
   * 对应微信小程序 `wx.openSetting` 的 API。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.openSetting.html
   *
   * 说明：
   * - 用于引导用户进入授权设置页，通常在用户拒绝过权限后作为二次引导入口。
   * - 常与 `getSetting`、`authorize` 组合使用，形成“读取状态 -> 申请权限 -> 打开设置页”的完整流程。
   *
   * 示例：
   * ```ts
   * const result = await wpi.openSetting()
   *
   * console.log(result.authSetting)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('openSetting')` 与 `wpi.supports('openSetting')` 判断。
   */
  openSetting: WeapiCrossPlatformAdapter['openSetting']
}
